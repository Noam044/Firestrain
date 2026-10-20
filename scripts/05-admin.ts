/**
 * 05-admin — department boundaries.
 *
 * Source: IGN ADMIN EXPRESS COG CARTO (latest edition) through the Géoplateforme
 * WFS, requested in Lambert-93 so coordinates arrive as planar metres (E, N).
 * Output:
 *   admin/departements-lignes.json  draped border lines for the 3D scene (scene km)
 *   admin/france-contour.json       dissolved national outline, rasterised as the land mask
 *   admin/departements-2d.json      simplified shapes as SVG paths for the 2D fallback
 * Usage: node scripts/05-admin.ts [--refresh]
 */
import mapshaper from "mapshaper";
import type { Feature, FeatureCollection, Geometry, Position } from "../lib/geo/geojson.ts";
import { L93_EXTENT, l93ToScene } from "../lib/geo/frame.ts";
import {
  BordersSchema,
  Departements2DSchema,
  FranceOutlineSchema,
} from "../lib/data/schemas.ts";
import { fetchCached, refreshRequested } from "./lib/http.ts";
import { IGN_OPEN_LICENCE, writeDataFile } from "./lib/manifest.ts";

const TYPENAME = "ADMINEXPRESS-COG-CARTO.LATEST:departement";
const LINE_TOLERANCE_M = 250;
const SHAPE_TOLERANCE_M = 800;

const params = new URLSearchParams({
  SERVICE: "WFS",
  VERSION: "2.0.0",
  REQUEST: "GetFeature",
  TYPENAMES: TYPENAME,
  OUTPUTFORMAT: "application/json",
  SRSNAME: "EPSG:2154",
  COUNT: "200",
});
const url = `https://data.geopf.fr/wfs/ows?${params}`;

console.log("Admin Express — départements");
const fetched = await fetchCached(url, "admin-express-departements.geojson", {
  refresh: refreshRequested,
  accept: /json/,
});

type DeptProps = { code: string; nom: string };
const source = JSON.parse(fetched.body.toString("utf8")) as FeatureCollection<
  Geometry,
  { code_insee: string; nom_officiel: string }
>;
const metropole: FeatureCollection<Geometry, DeptProps> = {
  type: "FeatureCollection",
  features: source.features
    .filter((f) => !f.properties.code_insee.startsWith("97"))
    .map((f) => ({
      type: "Feature",
      properties: { code: f.properties.code_insee, nom: f.properties.nom_officiel },
      geometry: f.geometry,
    })),
};
if (metropole.features.length !== 96) {
  throw new Error(`expected 96 metropolitan departments, got ${metropole.features.length}`);
}

/** No .prj is given, so mapshaper treats the Lambert-93 metres as planar units. */
async function mapshaperRun(commands: string): Promise<FeatureCollection> {
  const output = await mapshaper.applyCommands(
    `-i input.json ${commands} -o output.json geojson-type=FeatureCollection`,
    { "input.json": JSON.stringify(metropole) },
  );
  return JSON.parse(String(output["output.json"])) as FeatureCollection;
}

const lines = (geometry: Geometry): Position[][] => {
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  throw new Error(`unexpected geometry ${geometry.type}`);
};
const toScene = (line: Position[]) =>
  line.flatMap(([x, y]) => {
    const p = l93ToScene([x, y]);
    return [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100];
  });

// 3D lines: mapshaper -lines tags each arc as an outer or inner boundary.
const borderLines = await mapshaperRun(
  `-simplify interval=${LINE_TOLERANCE_M} keep-shapes -lines`,
);
const typeOf = (f: Feature) => String((f.properties ?? {}).TYPE ?? "");
const types = new Set(borderLines.features.map(typeOf));
if (!types.has("outer") || !types.has("inner")) {
  throw new Error(`unexpected -lines TYPE values: ${[...types].join(", ")}`);
}
const borders = BordersSchema.parse({
  crs: "scene-km",
  inner: borderLines.features
    .filter((f) => typeOf(f) === "inner" && f.geometry)
    .flatMap((f) => lines(f.geometry).map(toScene)),
  outer: borderLines.features
    .filter((f) => typeOf(f) === "outer" && f.geometry)
    .flatMap((f) => lines(f.geometry).map(toScene)),
});

// Land mask: the dissolved national outline, rasterised in the browser.
const dissolved = await mapshaperRun(
  `-dissolve -simplify interval=${LINE_TOLERANCE_M} keep-shapes`,
);
const ringsOf = (geometry: Geometry): Position[][] => {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  throw new Error(`unexpected geometry ${geometry.type}`);
};
const outline = FranceOutlineSchema.parse({
  crs: "scene-km",
  rings: dissolved.features.flatMap((f) => ringsOf(f.geometry).map(toScene)),
});

// 2D fallback: SVG paths in km, y pointing south from the extent's north edge.
const shapes = await mapshaperRun(`-simplify interval=${SHAPE_TOLERANCE_M} keep-shapes`);
const svgPoint = ([x, y]: Position) =>
  `${Math.round((x - L93_EXTENT.xmin) / 100) / 10} ${Math.round((L93_EXTENT.ymax - y) / 100) / 10}`;
const departements2d = Departements2DSchema.parse({
  crs: "l93-km-svg",
  viewBox: [
    0,
    0,
    (L93_EXTENT.xmax - L93_EXTENT.xmin) / 1000,
    (L93_EXTENT.ymax - L93_EXTENT.ymin) / 1000,
  ],
  features: shapes.features
    .map((f) => {
      const props = f.properties as DeptProps;
      const d = ringsOf(f.geometry)
        .map((ring) => `M${ring.slice(0, -1).map(svgPoint).join("L")}Z`)
        .join("");
      return { code: props.code, nom: props.nom, d };
    })
    .sort((a, b) => a.code.localeCompare(b.code)),
});

const provenance = {
  source: `IGN — ADMIN EXPRESS COG CARTO, dernière édition (WFS Géoplateforme, couche ${TYPENAME})`,
  sourceUrl: url,
  ...IGN_OPEN_LICENCE,
  retrievedAt: fetched.retrievedAt,
};
await writeDataFile("admin/departements-lignes.json", JSON.stringify(borders), {
  ...provenance,
  title: "Limites départementales (scène 3D)",
  transformations: [
    "sélection des 96 départements métropolitains",
    `simplification mapshaper, tolérance ${LINE_TOLERANCE_M} m`,
    "conversion en lignes (limites intérieures / contour national)",
    "coordonnées de scène en km, arrondies à 10 m",
  ],
});
await writeDataFile("admin/france-contour.json", JSON.stringify(outline), {
  ...provenance,
  title: "Contour de la France métropolitaine (masque terre)",
  transformations: [
    "sélection des 96 départements métropolitains",
    "fusion (dissolve) des départements",
    `simplification mapshaper, tolérance ${LINE_TOLERANCE_M} m`,
    "coordonnées de scène en km, arrondies à 10 m",
  ],
});
await writeDataFile("admin/departements-2d.json", JSON.stringify(departements2d), {
  ...provenance,
  title: "Départements (carte 2D de repli)",
  transformations: [
    "sélection des 96 départements métropolitains",
    `simplification mapshaper, tolérance ${SHAPE_TOLERANCE_M} m`,
    "chemins SVG en km, arrondis à 100 m",
  ],
});

console.log(
  `  → ${borders.inner.length} limites intérieures, ${borders.outer.length} tronçons de contour, ` +
    `${departements2d.features.length} départements` +
    (fetched.fromCache ? " (cache)" : ""),
);
