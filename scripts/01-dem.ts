/**
 * 01-dem — national relief for the 3D terrain.
 *
 * Source: IGN Géoplateforme WMS-Raster, BD ALTI® layer, requested directly in
 * Lambert-93 (EPSG:2154) as raw little-endian Float32: the service reprojects and
 * resamples server-side, so no GDAL is needed. One request per resolution — this
 * is a raster download, not point-by-point altimetry calls.
 *
 * Output: public/data/terrain/dem-<res>m.bin (fs-dem-1 + gzip) and .json metadata.
 * Usage: node scripts/01-dem.ts [--refresh]
 */
import { endianness } from "node:os";
import { gzipSync } from "node:zlib";
import { L93_EXTENT } from "../lib/geo/frame.ts";
import {
  DEM_CODEC,
  DEM_QUANTIZATION,
  encodeCodes,
  metersToCode,
} from "../lib/data/heightmap-codec.ts";
import { TerrainMetaSchema } from "../lib/data/schemas.ts";
import { fetchCached, refreshRequested } from "./lib/http.ts";
import { IGN_OPEN_LICENCE, writeDataFile } from "./lib/manifest.ts";

const LAYER = "ELEVATION.ELEVATIONGRIDCOVERAGE";
/** The service returns −99999 outside the BD ALTI coverage. */
const NODATA_BELOW = -9000;
/**
 * Inside coastal BD ALTI tiles the sea is stored as exactly 0.0 m (191 145 px at
 * 500 m during the phase 1 audit), whereas genuine near-sea-level land carries
 * non-zero decimals. Exact zeros are therefore treated as sea, i.e. no data.
 * The land mask itself comes from the ADMIN EXPRESS outline, not from this raster.
 */
const isNoData = (meters: number) => !(meters > NODATA_BELOW) || meters === 0;
const RESOLUTIONS_M = [500, 1000];

if (endianness() !== "LE") throw new Error("this script assumes a little-endian host");

for (const resolution of RESOLUTIONS_M) {
  const width = (L93_EXTENT.xmax - L93_EXTENT.xmin) / resolution;
  const height = (L93_EXTENT.ymax - L93_EXTENT.ymin) / resolution;
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`extent is not a multiple of ${resolution} m`);
  }

  const params = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.3.0",
    REQUEST: "GetMap",
    LAYERS: LAYER,
    STYLES: "",
    CRS: "EPSG:2154",
    BBOX: [L93_EXTENT.xmin, L93_EXTENT.ymin, L93_EXTENT.xmax, L93_EXTENT.ymax].join(","),
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: "image/x-bil;bits=32",
  });
  const url = `https://data.geopf.fr/wms-r/wms?${params}`;

  console.log(`DEM ${resolution} m — ${width} × ${height} px`);
  const fetched = await fetchCached(url, `dem-${resolution}m.bil`, {
    refresh: refreshRequested,
    accept: /x-bil/,
  });
  const expectedBytes = width * height * 4;
  if (fetched.body.length !== expectedBytes) {
    throw new Error(`expected ${expectedBytes} bytes, got ${fetched.body.length}`);
  }

  // Copy into a fresh, 4-byte aligned buffer before viewing it as Float32.
  const samples = new Float32Array(new Uint8Array(fetched.body).buffer);
  const codes = new Uint16Array(width * height);
  let minM = Number.POSITIVE_INFINITY;
  let maxM = Number.NEGATIVE_INFINITY;
  let landPixels = 0;
  for (let k = 0; k < samples.length; k++) {
    const meters = samples[k];
    if (isNoData(meters)) continue;
    codes[k] = metersToCode(meters);
    landPixels++;
    if (meters < minM) minM = meters;
    if (meters > maxM) maxM = meters;
  }

  // Sanity checks against known geography: Mont Blanc ≈ 4 806 m; the lowest
  // land is a few metres below sea level; France covers ≈ 44 % of the extent
  // (BD ALTI border tiles add a little foreign ground, masked out downstream).
  const landShare = landPixels / samples.length;
  if (maxM < 3500 || maxM > 4900 || minM < -50 || landShare < 0.42 || landShare > 0.48) {
    throw new Error(
      `implausible DEM: min ${minM} m, max ${maxM} m, land share ${(landShare * 100).toFixed(1)} %`,
    );
  }

  const base = `terrain/dem-${resolution}m`;
  const provenance = {
    title: `Relief de la France métropolitaine, maille ${resolution} m`,
    source: `IGN — BD ALTI® (Géoplateforme, WMS-Raster, couche ${LAYER})`,
    sourceUrl: url,
    ...IGN_OPEN_LICENCE,
    retrievedAt: fetched.retrievedAt,
    transformations: [
      "reprojection en Lambert-93 (EPSG:2154) par le service IGN",
      `rééchantillonnage à ${resolution} m par le service IGN`,
      "valeurs exactement nulles (mer dans les dalles côtières) traitées comme absence de donnée",
      "quantification à 0,1 m",
      "encodage fs-dem-1 + gzip",
    ],
  };

  const payload = gzipSync(encodeCodes(codes, width, height), { level: 9 });
  await writeDataFile(`${base}.bin`, payload, provenance);

  const meta = TerrainMetaSchema.parse({
    codec: DEM_CODEC,
    file: `${base}.bin`,
    width,
    height,
    pixelSizeM: resolution,
    extentL93: L93_EXTENT,
    quantization: DEM_QUANTIZATION,
    stats: { minM: Math.round(minM * 10) / 10, maxM: Math.round(maxM * 10) / 10, landPixels },
  });
  await writeDataFile(`${base}.json`, `${JSON.stringify(meta, null, 2)}\n`, {
    ...provenance,
    title: `Métadonnées — ${provenance.title}`,
  });

  console.log(
    `  → ${base}.bin ${(payload.length / 1e6).toFixed(2)} Mo · ` +
      `${minM.toFixed(1)} … ${maxM.toFixed(1)} m · terre ${(landShare * 100).toFixed(1)} %` +
      (fetched.fromCache ? " (cache)" : ""),
  );
}
