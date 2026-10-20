/**
 * 04-bdiff — fires declared by the fire services (BDIFF, IGN for the French
 * ministry of Agriculture).
 *
 * Public diffusion stops at the previous campaign: 2026 is not available
 * (checked on 2026-10-20). One CSV export per year 2006–2025 through the
 * "période glissante" search, which applies the BDIFF default "Type de feu : F".
 * The server omits its intermediate TLS certificate: the one named in its AIA
 * field (HARICA) is added to the trust store — verification stays on.
 *
 * Output:
 *   bdiff/annuel.json          yearly totals, national and per department
 *   bdiff/communes.json        per commune and year
 *   bdiff/rapprochements.json  EFFIS polygon ↔ BDIFF record when unambiguous
 * Usage: node scripts/04-bdiff.ts [--refresh]   (run 02-effis first)
 */
import { request } from "node:https";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { rootCertificates } from "node:tls";
import mapshaper from "mapshaper";
import { L93_ORIGIN, METERS_PER_UNIT } from "../lib/geo/frame.ts";
import { polygonsIntersect, ringsBBox, type BBox } from "../lib/geo/polygon.ts";
import { decodePolygons } from "../lib/geo/rings.ts";
import type { FeatureCollection, Geometry, Position } from "../lib/geo/geojson.ts";
import { parseCsv } from "../lib/data/csv.ts";
import {
  BdiffAnnualSchema,
  BdiffCommunesSchema,
  BdiffMatchesSchema,
  BdiffRecordSchema,
  EffisYearSchema,
  type BdiffRecord,
} from "../lib/data/schemas.ts";
import { fetchCached, readCache, refreshRequested, writeCache } from "./lib/http.ts";
import { PUBLIC_DATA_DIR, writeDataFile } from "./lib/manifest.ts";
import { readZipEntry } from "./lib/zip.ts";

const HOST = "bdiff.agriculture.gouv.fr";
const FIRST_YEAR = 2006;
const LAST_YEAR = 2025;
const INTERMEDIATE_URL = "http://crt.harica.gr/HARICA-GEANT-TLS-R1.cer";
/** Matching rule (validated with the project owner on 2026-10-20). */
const RULE = {
  /** EFFIS dates the first detection of a polygon, which may merge an earlier,
   * smaller fire: the window is symmetric. */
  windowDaysBefore: 10,
  windowDaysAfter: 10,
  /** BDIFF's own threshold between a "feu naissant" and a fire. */
  minAreaHa: 1,
  /** Declared and mapped areas of one fire differ, but not by orders of magnitude. */
  minAreaRatio: 0.25,
  maxAreaRatio: 4,
};
const BDIFF_SOURCE = "BDIFF — Base de données sur les incendies de forêt en France (IGN, ministère de l’Agriculture)";
const LICENCE = {
  licence: "Licence Ouverte 2.0",
  licenceUrl: "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
} as const;

// ── HTTPS with the missing intermediate and a session cookie ─────────────────
const intermediate = await fetchCached(INTERMEDIATE_URL, "harica-geant-tls-r1.cer");
const intermediatePem = intermediate.body.toString("latin1").startsWith("-----BEGIN")
  ? intermediate.body.toString("latin1")
  : `-----BEGIN CERTIFICATE-----\n${intermediate.body.toString("base64").replace(/.{64}/g, "$&\n")}\n-----END CERTIFICATE-----\n`;
const ca = [...rootCertificates, intermediatePem];

type Response = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer };

function get(path: string, cookie?: string): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        host: HOST,
        path,
        ca,
        headers: { "User-Agent": "FireStrain data pipeline (personal non-commercial project)", ...(cookie ? { Cookie: cookie } : {}) },
        timeout: 300_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      },
    );
    req.on("timeout", () => req.destroy(new Error(`timeout on ${path}`)));
    req.on("error", reject);
    req.end();
  });
}

async function exportYear(year: number) {
  const query = new URLSearchParams({
    "if[periodeAnnees][anneeDeb]": String(year),
    "if[periodeAnnees][anneeFin]": String(year),
    "if[periodeDeb][jour]": "01",
    "if[periodeDeb][mois]": "01",
    "if[periodeFin][jour]": "31",
    "if[periodeFin][mois]": "12",
    "if[submit]": "",
  });
  const url = `https://${HOST}/incendies?${query}`;
  const cacheName = `bdiff-${year}.zip`;
  if (!refreshRequested) {
    const cached = await readCache(cacheName, url);
    if (cached) return cached;
  }
  // The search stores the criteria in the session; the ZIP export reads them back.
  const search = await get(`/incendies?${query}`);
  if (search.status !== 200) throw new Error(`BDIFF search ${year}: HTTP ${search.status}`);
  const setCookie = search.headers["set-cookie"];
  const cookie = (Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [])
    .map((c) => c.split(";")[0])
    .join("; ");
  const zip = await get("/incendies/zip", cookie);
  if (zip.status !== 200 || !String(zip.headers["content-type"]).includes("zip")) {
    throw new Error(`BDIFF export ${year}: HTTP ${zip.status} ${zip.headers["content-type"]}`);
  }
  const meta = { url, retrievedAt: new Date().toISOString(), contentType: "application/zip" };
  await writeCache(cacheName, zip.body, meta);
  return { body: zip.body, ...meta, fromCache: false };
}

// ── Parse ────────────────────────────────────────────────────────────────────
const COLUMNS = {
  year: "Année",
  numero: "Numéro",
  departement: "Département",
  insee: "Code INSEE",
  commune: "Nom de la commune",
  alert: "Date de première alerte",
  area: "Surface parcourue (m2)",
  forest: "Surface forêt (m2)",
  surfacePrecision: "Précision des surfaces",
  cause: "Nature",
  deaths: "Nombre de décès",
  destroyed: "Nombre de bâtiments totalement détruits",
  damaged: "Nombre de bâtiments partiellement détruits",
  dataQuality: "Précision de la donnée",
} as const;

const number = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")));
const m2ToHa = (value: string) => {
  const m2 = number(value);
  return m2 === null ? null : Math.round(m2 / 100) / 100;
};
const integer = (value: string) => {
  const n = number(value);
  return n === null ? null : Math.round(n);
};

function parseYear(year: number, zip: Buffer): BdiffRecord[] {
  const rows = parseCsv(readZipEntry(zip, "Incendies.csv").toString("utf8"));
  // Preamble lines vary (older campaigns add a notice about the former form):
  // locate them by content, not position.
  const headerIndex = rows.findIndex((row) => row[0] === COLUMNS.year);
  const preamble = rows.slice(0, headerIndex).map((row) => row.join(" "));
  const announced = Number(
    /suivant les critères de sélection\s*:\s*(\d+)/.exec(preamble.join("\n"))?.[1] ?? Number.NaN,
  );
  const criteria = preamble.find((line) => line.startsWith("Critères de sélection")) ?? "";
  if (!criteria.includes("Type de feu : F")) throw new Error(`${year}: unexpected criteria « ${criteria} »`);
  const header = rows[headerIndex];
  const col = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, label]) => {
      const index = header.indexOf(label);
      if (index < 0) throw new Error(`${year}: column « ${label} » missing`);
      return [key, index];
    }),
  ) as Record<keyof typeof COLUMNS, number>;
  const data = rows.slice(headerIndex + 1).filter((row) => row.length >= header.length);
  if (data.length !== announced) throw new Error(`${year}: ${data.length} rows, ${announced} announced`);

  return data
    .filter((row) => /^(\d{2}|2A|2B)$/.test(row[col.departement]))
    .map((row) =>
      BdiffRecordSchema.parse({
        year: Number(row[col.year]),
        numero: row[col.numero],
        departement: row[col.departement],
        insee: row[col.insee],
        commune: row[col.commune],
        alert: row[col.alert].slice(0, 16),
        areaHa: m2ToHa(row[col.area]),
        forestHa: m2ToHa(row[col.forest]),
        surfacePrecision: row[col.surfacePrecision],
        cause: row[col.cause],
        dataQuality: row[col.dataQuality],
        deaths: integer(row[col.deaths]),
        buildingsDestroyed: integer(row[col.destroyed]),
        buildingsDamaged: integer(row[col.damaged]),
      }),
    );
}

console.log("BDIFF — feux déclarés (type F, France métropolitaine)");
const records: BdiffRecord[] = [];
const retrieved: string[] = [];
for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
  const exported = await exportYear(year);
  const parsed = parseYear(year, exported.body);
  if (parsed.some((r) => r.year !== year)) throw new Error(`${year}: records from another year`);
  records.push(...parsed);
  retrieved.push(exported.retrievedAt);
  const ha = parsed.reduce((sum, r) => sum + (r.areaHa ?? 0), 0);
  console.log(`  ${year} : ${String(parsed.length).padStart(5)} feux, ${String(Math.round(ha)).padStart(6)} ha`);
}
const retrievedAt = retrieved.sort()[0];

// ── Aggregates ───────────────────────────────────────────────────────────────
const round2 = (value: number) => Math.round(value * 100) / 100;
const annual = BdiffAnnualSchema.parse({
  fireType: "F",
  availableUpTo: LAST_YEAR,
  years: Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => {
    const year = FIRST_YEAR + i;
    const ofYear = records.filter((r) => r.year === year);
    const departements: Record<string, { fires: number; areaHa: number }> = {};
    for (const r of ofYear) {
      const d = (departements[r.departement] ??= { fires: 0, areaHa: 0 });
      d.fires += 1;
      d.areaHa += r.areaHa ?? 0;
    }
    for (const d of Object.values(departements)) d.areaHa = round2(d.areaHa);
    return {
      year,
      fires: ofYear.length,
      areaHa: round2(ofYear.reduce((sum, r) => sum + (r.areaHa ?? 0), 0)),
      departements,
    };
  }),
});

const byCommune = new Map<string, Map<number, [number, number]>>();
for (const r of records) {
  const years = byCommune.get(r.insee) ?? new Map<number, [number, number]>();
  const entry = years.get(r.year) ?? [0, 0];
  years.set(r.year, [entry[0] + 1, entry[1] + (r.areaHa ?? 0)]);
  byCommune.set(r.insee, years);
}
const communes = BdiffCommunesSchema.parse(
  Object.fromEntries(
    [...byCommune.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([insee, years]) => [
        insee,
        [...years.entries()].sort(([a], [b]) => a - b).map(([year, [fires, ha]]) => [year, fires, round2(ha)]),
      ]),
  ),
);

// ── EFFIS ↔ BDIFF: communes touched by each polygon, then a date window ─────
const COMMUNE_PAGE = 5000;
const communePageUrl = (start: number) =>
  `https://data.geopf.fr/wfs/ows?${new URLSearchParams({
    SERVICE: "WFS",
    VERSION: "2.0.0",
    REQUEST: "GetFeature",
    TYPENAMES: "ADMINEXPRESS-COG-CARTO.LATEST:commune",
    OUTPUTFORMAT: "application/json",
    SRSNAME: "EPSG:2154",
    PROPERTYNAME: "code_insee,geometrie",
    SORTBY: "code_insee",
    COUNT: String(COMMUNE_PAGE),
    STARTINDEX: String(start),
  })}`;
type CommuneProps = { code_insee: string };
const communeFeatures: FeatureCollection<Geometry, CommuneProps>["features"] = [];
for (let start = 0; ; start += COMMUNE_PAGE) {
  const page = await fetchCached(communePageUrl(start), `admin-express-communes-${start}.geojson`, {
    refresh: refreshRequested,
    accept: /json/,
  });
  const features = (JSON.parse(page.body.toString("utf8")) as FeatureCollection<Geometry, CommuneProps>).features;
  communeFeatures.push(...features);
  if (features.length < COMMUNE_PAGE) break;
}
const metroCommunes = communeFeatures.filter((f) => !f.properties.code_insee.startsWith("97"));
const simplifiedCommunes = JSON.parse(
  String(
    (
      await mapshaper.applyCommands("-i input.json -simplify interval=100 keep-shapes -o output.json geojson-type=FeatureCollection", {
        "input.json": JSON.stringify({ type: "FeatureCollection", features: metroCommunes }),
      })
    )["output.json"],
  ),
) as FeatureCollection<Geometry, CommuneProps>;

const flatRings = (geometry: Geometry): number[][] => {
  const polygons: Position[][][] =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  return polygons.flat().map((ring) => ring.flatMap(([x, y]) => [x, y]));
};
const communeShapes = simplifiedCommunes.features.map((f) => {
  const rings = flatRings(f.geometry);
  return { insee: f.properties.code_insee, rings, bbox: ringsBBox(rings) };
});

// Uniform grid over Lambert-93 to find communes near a polygon quickly.
const CELL_M = 20_000;
const grid = new Map<string, number[]>();
const cellsOf = (box: BBox) => {
  const keys: string[] = [];
  for (let i = Math.floor(box[0] / CELL_M); i <= Math.floor(box[2] / CELL_M); i++)
    for (let j = Math.floor(box[1] / CELL_M); j <= Math.floor(box[3] / CELL_M); j++) keys.push(`${i}:${j}`);
  return keys;
};
communeShapes.forEach((c, index) => cellsOf(c.bbox).forEach((key) => grid.set(key, [...(grid.get(key) ?? []), index])));

const recordsByYearCommune = new Map<string, BdiffRecord[]>();
for (const r of records) {
  const key = `${r.year}:${r.insee}`;
  recordsByYearCommune.set(key, [...(recordsByYearCommune.get(key) ?? []), r]);
}
const DAY = 86_400_000;
// BDIFF alert times are local; treating them as UTC shifts them by ≤ 2 h, negligible against the window.
const alertTime = (r: BdiffRecord) => Date.parse(`${r.alert.replace(" ", "T")}:00Z`);

const matches: Record<string, BdiffRecord & { sharedWith: number[] }> = {};
const matchedRecord = new Map<string, number[]>();
const yearSummaries = [];
for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
  const effis = EffisYearSchema.parse(
    JSON.parse(await readFile(join(PUBLIC_DATA_DIR, `effis/fires-${year}.json`), "utf8")),
  );
  let matched = 0;
  let ambiguous = 0;
  let noCandidate = 0;
  for (const fire of effis.fires) {
    // Scene km → Lambert-93 metres.
    const rings = decodePolygons(fire.polygons).map((ring) =>
      Array.from(ring, (v, k) => (k % 2 === 0 ? L93_ORIGIN.x + v * METERS_PER_UNIT : L93_ORIGIN.y - v * METERS_PER_UNIT)),
    );
    const box = ringsBBox(rings);
    const nearby = new Set(cellsOf(box).flatMap((key) => grid.get(key) ?? []));
    const touched = [...nearby].filter((i) => polygonsIntersect(rings, communeShapes[i].rings)).map((i) => communeShapes[i].insee);
    const detected = Date.parse(fire.firedate);
    const candidates = [...new Set(touched)].flatMap((insee) =>
      (recordsByYearCommune.get(`${year}:${insee}`) ?? []).filter((r) => {
        const t = alertTime(r);
        const ratio = (r.areaHa ?? 0) / fire.areaHa;
        return (
          (r.areaHa ?? 0) >= RULE.minAreaHa &&
          ratio >= RULE.minAreaRatio &&
          ratio <= RULE.maxAreaRatio &&
          t >= detected - RULE.windowDaysBefore * DAY &&
          t <= detected + RULE.windowDaysAfter * DAY
        );
      }),
    );
    if (candidates.length === 1) {
      matched++;
      const record = candidates[0];
      const key = `${record.year}:${record.numero}`;
      matchedRecord.set(key, [...(matchedRecord.get(key) ?? []), fire.id]);
      matches[String(fire.id)] = { ...record, sharedWith: [] };
    } else if (candidates.length > 1) ambiguous++;
    else noCandidate++;
  }
  yearSummaries.push({ year, polygons: effis.fires.length, matched, ambiguous, noCandidate });
  console.log(`  rapprochement ${year} : ${matched} univoques, ${ambiguous} ambigus, ${noCandidate} sans candidat`);
}
for (const ids of matchedRecord.values()) {
  for (const id of ids) matches[String(id)].sharedWith = ids.filter((other) => other !== id);
}
const rapprochements = BdiffMatchesSchema.parse({
  rule: {
    description:
      "Fiches BDIFF de la même année dont la commune touche le polygone EFFIS (ADMIN EXPRESS, dernière édition), " +
      "dont l’alerte est à 10 jours au plus de la première détection satellite, de 1 ha ou plus, et dont la " +
      "surface déclarée vaut entre 25 % et 400 % de la surface EFFIS. Lien conservé seulement s’il n’existe " +
      "qu’un candidat.",
    ...RULE,
  },
  years: yearSummaries,
  matches,
});

// ── Write ────────────────────────────────────────────────────────────────────
const provenance = {
  source: `${BDIFF_SOURCE}, export CSV de la consultation publique`,
  sourceUrl: `https://${HOST}/incendies`,
  ...LICENCE,
  retrievedAt,
};
const common = [
  `campagnes ${FIRST_YEAR}–${LAST_YEAR} (2026 non diffusée)`,
  "filtre « Type de feu : F » appliqué par la BDIFF à la recherche par période",
  "départements d’outre-mer exclus",
  "surfaces converties de m² en ha",
];
await writeDataFile("bdiff/annuel.json", `${JSON.stringify(annual)}\n`, {
  ...provenance,
  title: "Feux déclarés par année et par département (BDIFF)",
  transformations: [...common, "agrégation par année et par département"],
});
await writeDataFile("bdiff/communes.json", JSON.stringify(communes), {
  ...provenance,
  title: "Feux déclarés par commune et par année (BDIFF)",
  transformations: [...common, "agrégation par commune (code INSEE de la fiche) et par année"],
});
await writeDataFile("bdiff/rapprochements.json", JSON.stringify(rapprochements), {
  ...provenance,
  licence: `${LICENCE.licence} (BDIFF, IGN) · CC BY 4.0 (EFFIS)`,
  title: "Rapprochements automatiques EFFIS ↔ BDIFF",
  transformations: [
    ...common,
    "communes touchées calculées avec ADMIN EXPRESS COG CARTO (simplifié à 100 m)",
    rapprochements.rule.description,
  ],
});
const totalMatched = Object.keys(matches).length;
console.log(`  ${records.length} fiches, ${totalMatched} rapprochements univoques`);
