/**
 * 03-firms — thermal anomalies detected by NASA FIRMS (VIIRS), day by day.
 *
 * 2026: FIRMS area API (key in .env.local as FIRMS_MAP_KEY, never published),
 * S-NPP, NOAA-20 and NOAA-21, 1 June → 30 September; standard product (SP)
 * while available (to 30 June at the time of writing), near-real-time (NRT)
 * afterwards. 2012–2025: yearly S-NPP country archives (no key needed).
 *
 * Kept: detections inside metropolitan France (ADMIN EXPRESS outline), local
 * date in Paris between 1 June and 30 September, presumed vegetation fires.
 * Static heat sources (industry) are flagged `type = 2` in standard products;
 * NRT has no type, so NRT detections falling in a 750 m cell (or a neighbour)
 * where a static source was flagged are dropped.
 *
 * Detections are hotspots, not burnt areas: they are never converted to hectares.
 *
 * Output: firms/detections-<year>.bin (fs-firms-1 + gzip) and firms/index.json
 * Usage: node scripts/03-firms.ts [--refresh]   (run 05-admin first)
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { l93ToScene } from "../lib/geo/frame.ts";
import { lonLatToL93 } from "../lib/geo/projection.ts";
import { pointInRings, ringsBBox, bboxContains } from "../lib/geo/polygon.ts";
import { parseCsv } from "../lib/data/csv.ts";
import { encodeDetections, FIRMS_CODEC, SATELLITES, type Detections } from "../lib/data/firms-codec.ts";
import { FirmsIndexSchema, FranceOutlineSchema, type FirmsIndex } from "../lib/data/schemas.ts";
import { fetchCached, refreshRequested } from "./lib/http.ts";
import { PUBLIC_DATA_DIR, writeDataFile } from "./lib/manifest.ts";

const LAST_YEAR = 2026;
const FIRST_HISTORY_YEAR = 2012; // first full year of VIIRS S-NPP
const BBOX = "-5.5,41,10,51.5";
const WINDOW_DAYS = 5; // API maximum per request
const SP_AVAILABLE_UNTIL = "2026-06-30"; // /api/data_availability, checked on 2026-10-20
const STATIC_CELL_M = 750;

const FIRMS_LICENCE = {
  licence: "Données ouvertes de la NASA (réutilisation libre, citation demandée)",
  licenceUrl: "https://www.earthdata.nasa.gov/data/tools/firms",
} as const;
const FIRMS_CITATION =
  "NASA FIRMS — Fire Information for Resource Management System (LANCE / ESDIS), détections VIIRS 375 m";

try {
  process.loadEnvFile(join(import.meta.dirname, "..", ".env.local"));
} catch {
  // Optional: the variable may come from the environment.
}
const KEY = process.env.FIRMS_MAP_KEY;
if (!KEY) throw new Error("FIRMS_MAP_KEY manquante (.env.local)");

// ── Geography ────────────────────────────────────────────────────────────────
const outline = FranceOutlineSchema.parse(
  JSON.parse(await readFile(join(PUBLIC_DATA_DIR, "admin/france-contour.json"), "utf8")),
);
const rings = outline.rings.map((ring) => ({ ring, box: ringsBBox([ring]) }));
const franceBox = ringsBBox(outline.rings);
function inFrance(x: number, z: number): boolean {
  if (!bboxContains(franceBox, x, z)) return false;
  return pointInRings(x, z, rings.filter((r) => bboxContains(r.box, x, z)).map((r) => r.ring));
}

const parisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });
const dayOfYear = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000) + 1;
};
/** Timeline day of a UTC acquisition (acq_date + acq_time HHMM): 1 = 1 June in Paris. */
function timelineDay(acqDate: string, acqTime: string): number {
  const [y, m, d] = acqDate.split("-").map(Number);
  const hhmm = acqTime.padStart(4, "0");
  const local = parisDate.format(new Date(Date.UTC(y, m - 1, d, Number(hhmm.slice(0, 2)), Number(hhmm.slice(2)))));
  return dayOfYear(local) - dayOfYear(`${local.slice(0, 4)}-05-31`);
}

const CONFIDENCE: Record<string, number> = { l: 0, low: 0, n: 1, nominal: 1, h: 2, high: 2 };
const SATELLITE: Record<string, number> = { N: 0, "Suomi NPP": 0, N20: 1, "NOAA-20": 1, N21: 2, "NOAA-21": 2 };

type Row = Record<string, string>;
function rowsOf(csv: string): Row[] {
  const [header, ...data] = parseCsv(csv, ",");
  if (!header?.includes("latitude") || !header.includes("acq_date")) {
    throw new Error(`unexpected FIRMS answer: ${csv.slice(0, 200)}`);
  }
  return data.filter((r) => r.length === header.length).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

// ── Static sources mask (750 m cells flagged type = 2) ───────────────────────
const staticCells = new Set<string>();
const cellOf = (x: number, y: number) => [Math.floor(x / STATIC_CELL_M), Math.floor(y / STATIC_CELL_M)];
const flagStatic = (row: Row) => {
  if (row.type !== "2") return;
  const [i, j] = cellOf(...lonLatToL93([Number(row.longitude), Number(row.latitude)]));
  staticCells.add(`${i}:${j}`);
};
const nearStatic = (x: number, y: number) => {
  const [i, j] = cellOf(x, y);
  for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (staticCells.has(`${i + di}:${j + dj}`)) return true;
  return false;
};

const archiveUrl = (year: number) =>
  `https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/${year}/viirs-snpp_${year}_France.csv`;
const archive = async (year: number) =>
  fetchCached(archiveUrl(year), `firms-viirs-snpp-${year}-france.csv`, { refresh: refreshRequested });

// ── Collect ──────────────────────────────────────────────────────────────────
type Point = { x: number; z: number; day: number; frp: number; confidence: number; satellite: number; night: number; key: string };

function toPoint(row: Row, satelliteFallback?: number): Point | null {
  const [x, y] = lonLatToL93([Number(row.longitude), Number(row.latitude)]);
  const { x: sx, z: sz } = l93ToScene([x, y]);
  if (!inFrance(sx, sz)) return null;
  const day = timelineDay(row.acq_date, row.acq_time);
  if (day < 1 || day > 122) return null;
  const satellite = SATELLITE[row.satellite] ?? satelliteFallback;
  const confidence = CONFIDENCE[row.confidence];
  if (satellite === undefined || confidence === undefined) throw new Error(`unknown satellite/confidence: ${JSON.stringify(row)}`);
  return {
    x: sx,
    z: sz,
    day,
    frp: Math.min(65535, Math.round(Number(row.frp) * 10)),
    confidence,
    satellite,
    night: row.daynight === "N" ? 1 : 0,
    key: `${satellite}|${row.acq_date}|${row.acq_time}|${row.latitude}|${row.longitude}`,
  };
}

function pack(points: Point[]): Detections {
  const unique = [...new Map(points.map((p) => [p.key, p])).values()].sort((a, b) => a.day - b.day);
  const n = unique.length;
  const d: Detections = {
    count: n,
    positions: new Float32Array(2 * n),
    day: new Uint16Array(n),
    frp: new Uint16Array(n),
    confidence: new Uint8Array(n),
    satellite: new Uint8Array(n),
    night: new Uint8Array(n),
  };
  unique.forEach((p, k) => {
    d.positions[2 * k] = Math.round(p.x * 100) / 100;
    d.positions[2 * k + 1] = Math.round(p.z * 100) / 100;
    d.day[k] = p.day;
    d.frp[k] = p.frp;
    d.confidence[k] = p.confidence;
    d.satellite[k] = p.satellite;
    d.night[k] = p.night;
  });
  return d;
}

const yearEntries: FirmsIndex["years"] = [];
async function publish(year: number, detections: Detections, products: string[], provenance: { sourceUrl: string; retrievedAt: string; source: string; transformations: string[] }) {
  const file = `firms/detections-${year}.bin`;
  await writeDataFile(file, gzipSync(encodeDetections(detections), { level: 9 }), {
    title: `Détections d’anomalies thermiques VIIRS, 1er juin – 30 septembre ${year}`,
    ...FIRMS_LICENCE,
    ...provenance,
  });
  yearEntries.push({
    year,
    file,
    count: detections.count,
    satellites: [...new Set(Array.from(detections.satellite))].sort().map((s) => SATELLITES[s]),
    products,
  });
  console.log(`  ${year} : ${String(detections.count).padStart(6)} détections (${products.join(", ")})`);
}

console.log("NASA FIRMS — détections VIIRS (France métropolitaine, juin–septembre)");

// Static sources: 2025 S-NPP archive, then the 2026 standard product as it is read.
for (const row of rowsOf((await archive(2025)).body.toString("utf8"))) flagStatic(row);

// 2026 through the area API.
const SOURCES = ["VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21"] as const;
const windows: string[] = [];
for (let t = Date.UTC(LAST_YEAR, 5, 1); t <= Date.UTC(LAST_YEAR, 8, 30); t += WINDOW_DAYS * 86_400_000) {
  windows.push(new Date(t).toISOString().slice(0, 10));
}
const raw2026: { row: Row; product: "SP" | "NRT"; satellite: number }[] = [];
const retrieved: string[] = [];
for (const [s, source] of SOURCES.entries()) {
  for (const start of windows) {
    const product = start <= SP_AVAILABLE_UNTIL ? "SP" : "NRT";
    const path = `${source}_${product}/${BBOX}/${WINDOW_DAYS}/${start}`;
    const fetched = await fetchCached(
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/${path}`,
      `firms-${source}_${product}-${start}.csv`,
      { refresh: refreshRequested, publicUrl: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/${path}` },
    );
    retrieved.push(fetched.retrievedAt);
    for (const row of rowsOf(fetched.body.toString("utf8"))) {
      if (product === "SP") flagStatic(row);
      raw2026.push({ row, product, satellite: s });
    }
  }
}
const kept2026: Point[] = [];
for (const { row, product, satellite } of raw2026) {
  if (product === "SP" ? row.type !== "0" : false) continue;
  const point = toPoint(row, satellite);
  if (!point) continue;
  if (product === "NRT") {
    const [x, y] = lonLatToL93([Number(row.longitude), Number(row.latitude)]);
    if (nearStatic(x, y)) continue;
  }
  kept2026.push(point);
}

// History: S-NPP yearly archives (type 0 = presumed vegetation fire).
for (let year = FIRST_HISTORY_YEAR; year < LAST_YEAR; year++) {
  const fetched = await archive(year);
  const points = rowsOf(fetched.body.toString("utf8"))
    .filter((row) => row.type === "0")
    .map((row) => toPoint(row, 0))
    .filter((p): p is Point => p !== null);
  await publish(year, pack(points), ["S-NPP, produit standard (archive annuelle)"], {
    source: `${FIRMS_CITATION}, archive annuelle par pays`,
    sourceUrl: archiveUrl(year),
    retrievedAt: fetched.retrievedAt,
    transformations: [
      "détections de type 0 (feu de végétation présumé)",
      "France métropolitaine (contour ADMIN EXPRESS), 1er juin – 30 septembre (dates locales de Paris)",
      "Lambert-93 → coordonnées de scène arrondies à 10 m, encodage fs-firms-1 + gzip",
    ],
  });
}

await publish(LAST_YEAR, pack(kept2026), [`produit standard (SP) jusqu’au ${SP_AVAILABLE_UNTIL}`, "temps quasi réel (NRT) ensuite"], {
  source: `${FIRMS_CITATION}, API par zone (S-NPP, NOAA-20, NOAA-21)`,
  sourceUrl: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/VIIRS_SNPP_SP/${BBOX}/${WINDOW_DAYS}/${windows[0]}`,
  retrievedAt: retrieved.sort()[0],
  transformations: [
    `requêtes de ${WINDOW_DAYS} jours, produit standard jusqu’au ${SP_AVAILABLE_UNTIL} puis temps quasi réel`,
    "produit standard : détections de type 0 seulement",
    `temps quasi réel : exclusion des mailles de ${STATIC_CELL_M} m (et voisines) où une source fixe a été signalée (archive 2025, produit standard 2026)`,
    "France métropolitaine (contour ADMIN EXPRESS), 1er juin – 30 septembre (dates locales de Paris), doublons retirés",
    "Lambert-93 → coordonnées de scène arrondies à 10 m, encodage fs-firms-1 + gzip",
  ],
});

const index = FirmsIndexSchema.parse({
  codec: FIRMS_CODEC,
  timeline: { from: "06-01", to: "09-30", days: 122 },
  years: yearEntries.sort((a, b) => a.year - b.year),
});
await writeDataFile("firms/index.json", `${JSON.stringify(index, null, 2)}\n`, {
  title: "Index des détections FIRMS par année",
  source: FIRMS_CITATION,
  sourceUrl: "https://firms.modaps.eosdis.nasa.gov/",
  ...FIRMS_LICENCE,
  retrievedAt: retrieved.sort()[0],
  transformations: ["nombre de détections retenues par année"],
});
console.log(`  mailles « source fixe » : ${staticCells.size}`);
