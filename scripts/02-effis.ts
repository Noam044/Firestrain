/**
 * 02-effis — burnt areas (EFFIS, Copernicus / JRC).
 *
 * Source: the EFFIS REST API (rest/2/burntareas/current — despite its name it
 * holds the whole archive since 2000), paged and cached per page; the WFS
 * documented on the EFFIS site answered 500/503 during the audit. Official
 * country statistics come from the EFFIS statistics API (api2).
 *
 * Output:
 *   effis/fires-<year>.json  metropolitan polygons 2006–2026, Lambert-93 →
 *                            scene km, simplified (40 m), delta-encoded
 *   effis/index.json         per-year counts and totals (all / ≥ 30 ha)
 *   effis/stats.json         official yearly totals and the weekly series
 * Usage: node scripts/02-effis.ts [--refresh]
 */
import mapshaper from "mapshaper";
import { z } from "zod";
import { l93ToScene } from "../lib/geo/frame.ts";
import { lonLatToL93 } from "../lib/geo/projection.ts";
import { ringsBBox } from "../lib/geo/polygon.ts";
import { encodeRing } from "../lib/geo/rings.ts";
import type { FeatureCollection, Geometry, Position } from "../lib/geo/geojson.ts";
import {
  EffisIndexSchema,
  EffisStatsSchema,
  EffisYearSchema,
  LAND_COVER_KEYS,
  type EffisFire,
} from "../lib/data/schemas.ts";
import { fetchCached, refreshRequested, type Fetched } from "./lib/http.ts";
import { writeDataFile } from "./lib/manifest.ts";

const API = "https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/";
const STATS_API = "https://api2.effis.emergency.copernicus.eu/statistics/v2/effis";
const PAGE_SIZE = 500;
const FIRST_YEAR = 2006;
const LAST_YEAR = 2026;
const THRESHOLD_HA = 30;
const SIMPLIFY_M = 40;
/** Metropolitan France incl. Corsica (excludes the overseas polygons labelled FR). */
const METRO = { lonMin: -5.5, lonMax: 10, latMin: 41, latMax: 51.5 };

const EFFIS_LICENCE = {
  licence: "CC BY 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const;
const EFFIS_SOURCE = "EFFIS — European Forest Fire Information System (Copernicus, Commission européenne / JRC)";

const NumberLike = z.union([z.number(), z.string()]).nullable();
const RawRecord = z.object({
  id: z.number().int(),
  centroid: z.object({ type: z.literal("Point"), coordinates: z.array(z.number()).min(2) }),
  shape: z.object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.array(z.unknown()),
  }),
  country: z.string(),
  province: z.string().nullable(),
  commune: z.string().nullable(),
  firedate: z.string(),
  lastupdate: z.string(),
  area_ha: z.number(),
  percna2k: NumberLike,
  ...Object.fromEntries(LAND_COVER_KEYS.map((key) => [key, NumberLike])),
});
type RawRecord = z.infer<typeof RawRecord> & Record<string, unknown>;
const RawPage = z.object({ count: z.number().int(), results: z.array(RawRecord) });

const toNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);
const round1 = (value: number) => Math.round(value * 10) / 10;
const iso = (value: string) => new Date(value).toISOString();
/** Year of the date as published by EFFIS (local time, e.g. "2026-07-22T11:55:00+02:00"). */
const localYear = (date: string) => Number(date.slice(0, 4));

// ── Download ────────────────────────────────────────────────────────────────
console.log("EFFIS — surfaces brûlées (France)");
const pageUrl = (offset: number) => `${API}?country=FR&limit=${PAGE_SIZE}&ordering=id&offset=${offset}`;
const pageName = (offset: number) => `effis-fr-${String(offset).padStart(5, "0")}.json`;

const pages: Fetched[] = [await fetchCached(pageUrl(0), pageName(0), { refresh: refreshRequested, accept: /json/ })];
const total = RawPage.parse(JSON.parse(pages[0].body.toString("utf8"))).count;
for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
  pages.push(await fetchCached(pageUrl(offset), pageName(offset), { refresh: refreshRequested, accept: /json/ }));
}
const records: RawRecord[] = pages.flatMap((page) => RawPage.parse(JSON.parse(page.body.toString("utf8"))).results);
if (records.length !== total) throw new Error(`expected ${total} records, got ${records.length}`);
if (new Set(records.map((r) => r.id)).size !== total) throw new Error("duplicate EFFIS ids across pages");
const retrievedAt = pages.map((p) => p.retrievedAt).sort()[0];
console.log(`  ${total} polygones téléchargés (${pages.length} pages)`);

// ── Selection and reprojection ───────────────────────────────────────────────
const selected = records.filter((r) => {
  const [lon, lat] = r.centroid.coordinates;
  const year = localYear(r.firedate);
  return (
    lon >= METRO.lonMin && lon <= METRO.lonMax && lat >= METRO.latMin && lat <= METRO.latMax &&
    year >= FIRST_YEAR && year <= LAST_YEAR
  );
});

const toL93 = (coordinates: unknown, type: "Polygon" | "MultiPolygon"): Position[][][] => {
  const polygons = (type === "Polygon" ? [coordinates] : coordinates) as Position[][][];
  return polygons.map((rings) => rings.map((ring) => ring.map(([lon, lat]) => [...lonLatToL93([lon, lat])])));
};
const collection: FeatureCollection<Geometry, { id: number }> = {
  type: "FeatureCollection",
  features: selected.map((r) => ({
    type: "Feature",
    properties: { id: r.id },
    geometry: { type: "MultiPolygon", coordinates: toL93(r.shape.coordinates, r.shape.type) },
  })),
};

// No .prj: mapshaper simplifies the Lambert-93 metres as planar units, keeping
// topology between adjacent polygons and never dropping a whole polygon.
const simplifiedOut = await mapshaper.applyCommands(
  `-i input.json -simplify interval=${SIMPLIFY_M} keep-shapes -o output.json geojson-type=FeatureCollection`,
  { "input.json": JSON.stringify(collection) },
);
const simplified = JSON.parse(String(simplifiedOut["output.json"])) as FeatureCollection<Geometry, { id: number }>;
const geometryById = new Map(simplified.features.map((f) => [f.properties.id, f.geometry]));

function encodeGeometry(geometry: Geometry): { polygons: number[][][]; bbox: EffisFire["bbox"] } {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  const sceneRings: number[][] = [];
  const encoded = polygons
    .map((rings) =>
      rings
        .map((ring) => {
          const flat = ring.flatMap(([x, y]) => {
            const p = l93ToScene([x, y]);
            return [p.x, p.z];
          });
          sceneRings.push(flat);
          return encodeRing(flat);
        })
        .filter((ring) => ring.length >= 6),
    )
    .filter((rings) => rings.length > 0);
  const box = ringsBBox(sceneRings).map((v) => Math.round(v * 100) / 100);
  return { polygons: encoded, bbox: [box[0], box[1], box[2], box[3]] };
}

function landCover(r: RawRecord): EffisFire["landCover"] {
  const values = LAND_COVER_KEYS.map((key) => toNumber(r[key]));
  return values.some((v) => v === null) ? null : values.map((v) => round1(v as number));
}

const firesByYear = new Map<number, EffisFire[]>();
for (const r of selected) {
  const geometry = geometryById.get(r.id);
  if (!geometry) throw new Error(`polygon ${r.id} lost during simplification`);
  const { polygons, bbox } = encodeGeometry(geometry);
  if (polygons.length === 0) throw new Error(`polygon ${r.id} has no ring left after encoding`);
  const natura = toNumber(r.percna2k);
  const fire: EffisFire = {
    id: r.id,
    firedate: iso(r.firedate),
    lastUpdate: iso(r.lastupdate),
    areaHa: r.area_ha,
    province: r.province ?? "",
    commune: r.commune ?? "",
    landCover: landCover(r),
    natura2000Pct: natura === null ? null : round1(natura),
    bbox,
    polygons,
  };
  const year = localYear(r.firedate);
  firesByYear.set(year, [...(firesByYear.get(year) ?? []), fire]);
}

// ── Output: one file per year + index ────────────────────────────────────────
const apiProvenance = {
  source: `${EFFIS_SOURCE}, API burntareas`,
  sourceUrl: pageUrl(0),
  ...EFFIS_LICENCE,
  retrievedAt,
};
const yearEntries = [];
for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
  const fires = (firesByYear.get(year) ?? []).sort((a, b) => a.firedate.localeCompare(b.firedate));
  const file = `effis/fires-${year}.json`;
  const payload = EffisYearSchema.parse({ year, encoding: "scene-10m-delta", fires });
  const entry = await writeDataFile(file, JSON.stringify(payload), {
    ...apiProvenance,
    title: `Surfaces brûlées ${year} (EFFIS)`,
    transformations: [
      "sélection de la France métropolitaine",
      "reprojection WGS84 → Lambert-93 (EPSG:2154)",
      `simplification mapshaper, tolérance ${SIMPLIFY_M} m`,
      "coordonnées de scène arrondies à 10 m, codage différentiel",
      "dates converties en UTC ; surfaces et couverts publiés par EFFIS conservés",
    ],
  });
  const big = fires.filter((f) => f.areaHa >= THRESHOLD_HA);
  yearEntries.push({
    year,
    file,
    fires: fires.length,
    firesAtLeast30: big.length,
    areaHa: fires.reduce((sum, f) => sum + f.areaHa, 0),
    areaHaAtLeast30: big.reduce((sum, f) => sum + f.areaHa, 0),
    lastUpdate: fires.map((f) => f.lastUpdate).sort().at(-1) ?? retrievedAt,
  });
  console.log(
    `  ${year} : ${String(fires.length).padStart(4)} polygones, ` +
      `${String(Math.round(yearEntries.at(-1)!.areaHaAtLeast30)).padStart(6)} ha (≥ 30 ha), ` +
      `${(entry.bytes / 1000).toFixed(0)} ko`,
  );
}
const index = EffisIndexSchema.parse({ thresholdHa: THRESHOLD_HA, years: yearEntries });
await writeDataFile("effis/index.json", `${JSON.stringify(index, null, 2)}\n`, {
  ...apiProvenance,
  title: "Index des surfaces brûlées par année (EFFIS)",
  transformations: ["totaux recalculés à partir des polygones publiés par EFFIS (tous / ≥ 30 ha)"],
});

// ── Official statistics ──────────────────────────────────────────────────────
const AnnualRaw = z.array(z.object({ year: z.number().int(), ba: z.number(), nf: z.number().int() }));
const WeekRaw = z.object({
  week: z.number().int(),
  min_year: z.number().int(),
  mddate: z.string().regex(/^\d{8}$/),
  area_ha: z.number().nullable(),
  area_ha_min: z.number(),
  area_ha_avg: z.number(),
  area_ha_max: z.number(),
});
const WeeklyRaw = z.object({ banfweekly: z.array(WeekRaw), banfcumulative: z.array(WeekRaw) });

const annualUrl = `${STATS_API}/estimatesbycountry?country=FRA`;
const weeklyUrl = `${STATS_API}/weekly?country=FRA&year=${LAST_YEAR}`;
const annualFetched = await fetchCached(annualUrl, "effis-stats-annual-fra.json", { refresh: refreshRequested, accept: /json/ });
const weeklyFetched = await fetchCached(weeklyUrl, `effis-stats-weekly-fra-${LAST_YEAR}.json`, {
  refresh: refreshRequested,
  accept: /json/,
});
const annual = AnnualRaw.parse(JSON.parse(annualFetched.body.toString("utf8")));
const weekly = WeeklyRaw.parse(JSON.parse(weeklyFetched.body.toString("utf8")));
const cumulativeByWeek = new Map(weekly.banfcumulative.map((w) => [w.week, w]));
const stats = EffisStatsSchema.parse({
  annual: annual.map((a) => ({ year: a.year, areaHa: a.ba, fires: a.nf })),
  weekly: {
    year: LAST_YEAR,
    referenceFrom: weekly.banfweekly[0]?.min_year ?? FIRST_YEAR,
    weeks: weekly.banfweekly.map((w) => {
      const c = cumulativeByWeek.get(w.week);
      if (!c) throw new Error(`no cumulative value for week ${w.week}`);
      return {
        week: w.week,
        date: `${w.mddate.slice(0, 4)}-${w.mddate.slice(4, 6)}-${w.mddate.slice(6, 8)}`,
        areaHa: w.area_ha,
        cumulativeHa: c.area_ha,
        cumulativeMinHa: c.area_ha_min,
        cumulativeMeanHa: c.area_ha_avg,
        cumulativeMaxHa: c.area_ha_max,
      };
    }),
  },
});
await writeDataFile("effis/stats.json", `${JSON.stringify(stats, null, 2)}\n`, {
  title: "Statistiques officielles EFFIS pour la France (annuelles et hebdomadaires)",
  source: `${EFFIS_SOURCE}, API du portail EFFIS Statistics`,
  sourceUrl: annualUrl,
  ...EFFIS_LICENCE,
  retrievedAt: [annualFetched.retrievedAt, weeklyFetched.retrievedAt].sort()[0],
  transformations: [
    "champs renommés (ba → areaHa, nf → fires)",
    `série hebdomadaire ${LAST_YEAR} : cumul, et min / moyenne / max des années de référence publiés par EFFIS`,
  ],
});
console.log(`  statistiques : ${stats.annual.length} années, ${stats.weekly.weeks.length} semaines`);
