/**
 * 08-neighbours — the countries around France, drawn flat and neutral on the
 * map so that France is not an island without being upstaged.
 *
 * Source: Natural Earth 1:10m admin-0 countries (public domain). France itself
 * keeps its IGN outline (05-admin); only the other countries are published,
 * clipped to the map extent, simplified and projected into the scene frame.
 * Output: admin/voisins.json
 * Usage: node scripts/08-neighbours.ts [--refresh]
 */
import mapshaper from "mapshaper";
import type { FeatureCollection, Geometry, Position } from "../lib/geo/geojson.ts";
import { L93_EXTENT, l93ToScene } from "../lib/geo/frame.ts";
import { EPSG_2154 } from "../lib/geo/projection.ts";
import { NeighboursSchema } from "../lib/data/schemas.ts";
import { fetchCached, refreshRequested } from "./lib/http.ts";
import { writeDataFile } from "./lib/manifest.ts";

const SOURCE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson";
/**
 * Clipped in Lambert-93, to the map extent plus a margin wider than any view of
 * it: the cut runs parallel to the map edges, out of sight, and countries far
 * from France (whose outlines would only weigh on the page) are left out.
 */
const MARGIN_M = 500_000;
const CLIP_BBOX = [
  L93_EXTENT.xmin - MARGIN_M,
  L93_EXTENT.ymin - MARGIN_M,
  L93_EXTENT.xmax + MARGIN_M,
  L93_EXTENT.ymax + MARGIN_M,
];
/** A first, rough cut in degrees, so that only Europe goes through the conic projection. */
const DEGREES_BBOX = [-30, 25, 40, 70];
const SIMPLIFY_M = 400;

console.log("Pays voisins (Natural Earth 1:10m)");
const fetched = await fetchCached(SOURCE_URL, "natural-earth-10m-admin0.geojson", { refresh: refreshRequested });
const source = JSON.parse(fetched.body.toString("utf8")) as FeatureCollection<Geometry, Record<string, unknown>>;

const output = await mapshaper.applyCommands(
  `-i input.json -filter "ADM0_A3 !== 'FRA'" -clip bbox=${DEGREES_BBOX.join(",")} -proj '${EPSG_2154}' -clip bbox=${CLIP_BBOX.join(",")} -simplify interval=${SIMPLIFY_M} keep-shapes -filter-fields ADM0_A3,NAME_FR -o output.json geojson-type=FeatureCollection`,
  { "input.json": JSON.stringify(source) },
);
const clipped = JSON.parse(String(output["output.json"])) as FeatureCollection<Geometry, { ADM0_A3: string; NAME_FR: string }>;

const toScene = (ring: Position[]) =>
  ring.flatMap(([x, y]) => {
    const p = l93ToScene([x, y]);
    return [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100];
  });
const polygonsOf = (geometry: Geometry): Position[][][] => {
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
};

const neighbours = NeighboursSchema.parse({
  crs: "scene-km",
  countries: clipped.features
    .filter((feature) => feature.geometry)
    .map((feature) => ({
      code: feature.properties.ADM0_A3,
      name: feature.properties.NAME_FR,
      polygons: polygonsOf(feature.geometry).map((polygon) => polygon.map(toScene).filter((ring) => ring.length >= 6)),
    }))
    .filter((country) => country.polygons.length > 0),
});

await writeDataFile("admin/voisins.json", JSON.stringify(neighbours), {
  title: "Pays voisins de la France (contexte de carte)",
  source: "Natural Earth, Admin 0 – Countries, 1:10m",
  sourceUrl: SOURCE_URL,
  licence: "Domaine public (Natural Earth)",
  licenceUrl: "https://www.naturalearthdata.com/about/terms-of-use/",
  retrievedAt: fetched.retrievedAt,
  transformations: [
    "pays autres que la France, projetés en Lambert-93 et découpés au cadre de la carte élargi de 500 km",
    `simplification mapshaper, tolérance ${SIMPLIFY_M} m`,
    "Lambert-93 → coordonnées de scène en km, arrondies à 10 m",
  ],
});
console.log(`  ${neighbours.countries.map((c) => c.name).join(", ")}`);
