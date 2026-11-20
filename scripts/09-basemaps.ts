/**
 * 09-basemaps — whole-France images of the IGN base maps, served by the site.
 *
 * The WMS renders each image on request (5–6 s for the whole country), which
 * the map used to wait for at every visit. These images change rarely: they
 * are requested once here, in Lambert-93 over the scene extent, and published
 * under public/data, cached by the browser and the host. Close-up views use the
 * Géoplateforme's pre-rendered Lambert-93 tiles (components/scene/Imagery.ts).
 * Output: fonds/<id>-france.jpg
 * Usage: node scripts/09-basemaps.ts [--refresh]
 */
import { BASEMAPS, farImagePath, wmsUrl } from "../lib/geo/basemaps.ts";
import { L93_EXTENT, SCENE_SIZE } from "../lib/geo/frame.ts";
import { fetchCached, refreshRequested } from "./lib/http.ts";
import { writeDataFile } from "./lib/manifest.ts";

/** ≈ 570 m per pixel: the scale of the whole-country view; closer views switch to tiles. */
const WIDTH = 2048;
const HEIGHT = Math.round((WIDTH * SCENE_SIZE.depth) / SCENE_SIZE.width);

console.log("Fonds de carte : images de la France entière (IGN, WMS)");
for (const basemap of BASEMAPS) {
  if (!basemap.ign || !basemap.source) continue;
  const url = wmsUrl(basemap.ign.wms, [L93_EXTENT.xmin, L93_EXTENT.ymin], [L93_EXTENT.xmax, L93_EXTENT.ymax], WIDTH, HEIGHT);
  const fetched = await fetchCached(url, `fond-${basemap.id}-france.jpg`, { refresh: refreshRequested, accept: /^image\/jpeg/ });
  const entry = await writeDataFile(farImagePath(basemap.id), fetched.body, {
    title: `Fond de carte « ${basemap.label} », France entière`,
    source: basemap.source.fullName,
    sourceUrl: url,
    licence: basemap.source.licence,
    licenceUrl: basemap.source.licenceUrl,
    retrievedAt: fetched.retrievedAt,
    transformations: [`image WMS ${WIDTH} × ${HEIGHT} px en Lambert-93 (EPSG:2154) sur l’emprise de la scène, publiée telle quelle`],
  });
  console.log(`  ${basemap.label} : ${(entry.bytes / 1000).toFixed(0)} ko`);
}
