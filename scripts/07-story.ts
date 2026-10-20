/**
 * 07-story — figures of the story (home page), from published data and from
 * the hand-curated facts of data/events.json.
 *
 * - every quote of data/events.json must appear in its source page (fetched and cached);
 * - EFFIS polygons of each event are regrouped by the rule written in the file
 *   (contiguity or department + period); the expected ids must match;
 * - Paris (ADMIN EXPRESS commune 75056) is read in Lambert-93, the frame of the
 *   fires, for an exact-scale comparison with the Gironde fire.
 *
 * Output: story/story.json
 * Usage: node scripts/07-story.ts [--refresh]   (run 02-effis first)
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { decodeFire, type DecodedFire } from "../lib/data/fires.ts";
import {
  EffisIndexSchema,
  EffisYearSchema,
  LAND_COVER_KEYS,
  StorySchema,
  StorySourceSchema,
  type Story,
  type StoryFact,
} from "../lib/data/schemas.ts";
import { l93ToScene } from "../lib/geo/frame.ts";
import { ringsBBox } from "../lib/geo/polygon.ts";
import { lonLatToL93, sceneToLonLat } from "../lib/geo/projection.ts";
import { encodeRing } from "../lib/geo/rings.ts";
import { fetchCached, refreshRequested } from "./lib/http.ts";
import { IGN_OPEN_LICENCE, PUBLIC_DATA_DIR, writeDataFile } from "./lib/manifest.ts";

const YEAR = 2026;
const ROOT = join(import.meta.dirname, "..");

const source = StorySourceSchema.parse(JSON.parse(await readFile(join(ROOT, "data/events.json"), "utf8")));
const effisIndex = EffisIndexSchema.parse(JSON.parse(await readFile(join(PUBLIC_DATA_DIR, "effis/index.json"), "utf8")));
const effisYear = EffisYearSchema.parse(
  JSON.parse(await readFile(join(PUBLIC_DATA_DIR, `effis/fires-${YEAR}.json`), "utf8")),
);
const fires = effisYear.fires.map(decodeFire);
const byId = new Map(fires.map((fire) => [fire.id, fire]));
const parisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });
const localDate = (fire: DecodedFire) => parisDate.format(new Date(fire.firedate));

console.log(`Récit ${YEAR}`);

// ── Quotes: each one must be found in its page ───────────────────────────────
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  laquo: "«", raquo: "»", euro: "€", oelig: "œ", hellip: "…", ndash: "–", mdash: "—",
};
/** Accented letters written as named entities (&eacute;, &agrave;, &ccedil;…). */
const ACCENTS: Record<string, string> = { acute: "\u0301", grave: "\u0300", circ: "\u0302", uml: "\u0308", cedil: "\u0327" };
function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z])(acute|grave|circ|uml|cedil);/gi, (_, letter: string, accent: string) =>
      `${letter}${ACCENTS[accent.toLowerCase()]}`.normalize("NFC"),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}
/** Same text whatever the apostrophes, spaces and line breaks. */
const normalise = (text: string) =>
  text.replace(/[’‘]/g, "'").replace(/[  \s]+/g, " ").trim().toLowerCase();

const facts: StoryFact[] = [...source.events.flatMap((event) => event.facts), ...source.insurance];
for (const fact of facts) {
  const cacheName = `story-${createHash("sha1").update(fact.url).digest("hex").slice(0, 12)}.html`;
  const page = await fetchCached(fact.url, cacheName, { refresh: refreshRequested });
  if (!normalise(pageText(page.body.toString("utf8"))).includes(normalise(fact.quote))) {
    throw new Error(`citation introuvable (${fact.id}) dans ${fact.url} : « ${fact.quote} »`);
  }
}
console.log(`  ${facts.length} citations retrouvées dans leurs pages`);

// ── EFFIS groups ──────────────────────────────────────────────────────────────
function vertexDistance(a: DecodedFire, b: DecodedFire): number {
  let best = Number.POSITIVE_INFINITY;
  for (const ra of a.rings)
    for (const rb of b.rings)
      for (let i = 0; i < ra.length; i += 2)
        for (let j = 0; j < rb.length; j += 2) {
          const d = (ra[i] - rb[j]) ** 2 + (ra[i + 1] - rb[j + 1]) ** 2;
          if (d < best) best = d;
        }
  return Math.sqrt(best);
}
const bboxGap = (a: DecodedFire, b: DecodedFire) =>
  Math.max(a.bbox[0] - b.bbox[2], b.bbox[0] - a.bbox[2], a.bbox[1] - b.bbox[3], b.bbox[1] - a.bbox[3], 0);

const events: Story["events"] = source.events.map((event) => {
  const inWindow = fires.filter((fire) => localDate(fire) >= event.from && localDate(fire) <= event.to);
  let members: DecodedFire[];
  if (event.group.rule === "department-window") {
    members = inWindow.filter((fire) => fire.province === event.department);
  } else {
    const { seed, maxGapKm } = event.group;
    const start = byId.get(seed);
    if (!start || !inWindow.includes(start)) throw new Error(`${event.id} : polygone ${seed} absent de la période`);
    members = [start];
    const pending = [start];
    while (pending.length > 0) {
      const current = pending.pop()!;
      for (const fire of inWindow) {
        if (members.includes(fire) || bboxGap(current, fire) > maxGapKm) continue;
        if (vertexDistance(current, fire) <= maxGapKm) {
          members.push(fire);
          pending.push(fire);
        }
      }
    }
    const expected = [...(event.effisIds ?? [])].sort();
    const found = members.map((fire) => fire.id).sort();
    if (JSON.stringify(expected) !== JSON.stringify(found)) {
      throw new Error(`${event.id} : groupe recalculé [${found}] ≠ data/events.json [${expected}]`);
    }
  }
  if (members.length === 0) throw new Error(`${event.id} : aucun polygone EFFIS`);
  members.sort((a, b) => b.areaHa - a.areaHa);
  const areaHa = members.reduce((sum, fire) => sum + fire.areaHa, 0);
  const withCover = members.filter((fire) => fire.landCover);
  const coverArea = withCover.reduce((sum, fire) => sum + fire.areaHa, 0);
  const landCover =
    coverArea > 0
      ? LAND_COVER_KEYS.map((_, k) => withCover.reduce((sum, fire) => sum + fire.landCover![k] * fire.areaHa, 0) / coverArea)
      : null;
  const firstDetection = members.map((fire) => fire.firedate).sort()[0];
  console.log(`  ${event.id} : ${members.length} polygones, ${Math.round(areaHa)} ha (EFFIS)`);
  return {
    id: event.id,
    title: event.title,
    department: event.department,
    from: event.from,
    to: event.to,
    justification: event.group.justification,
    effis: {
      ids: members.map((fire) => fire.id),
      mainId: event.group.rule === "contiguous" ? event.group.seed : members[0].id,
      areaHa: Math.round(areaHa),
      polygons: members.length,
      firstDetection,
      bbox: ringsBBox(members.flatMap((fire) => fire.rings)),
      landCover: landCover?.map((share) => Math.round(share * 10) / 10) ?? null,
    },
    facts: event.facts,
  };
});

// ── Headline ────────────────────────────────────────────────────────────────
const entry = effisIndex.years.find((y) => y.year === YEAR);
if (!entry) throw new Error(`EFFIS ${YEAR} absent de l'index`);
const previous = effisIndex.years.filter((y) => y.year < YEAR).sort((a, b) => b.areaHaAtLeast30 - a.areaHaAtLeast30)[0];
const atLeast30 = fires.filter((fire) => fire.areaHa >= effisIndex.thresholdHa);
const monthlyAreaHa = Array.from({ length: 12 }, (_, month) =>
  Math.round(
    atLeast30
      .filter((fire) => Number(localDate(fire).slice(5, 7)) === month + 1)
      .reduce((sum, fire) => sum + fire.areaHa, 0),
  ),
);
const seasonAreaHa = Math.round(
  atLeast30
    .filter((fire) => localDate(fire) >= `${YEAR}-06-01` && localDate(fire) <= `${YEAR}-09-30`)
    .reduce((sum, fire) => sum + fire.areaHa, 0),
);

// ── Paris, for the exact-scale comparison ─────────────────────────────────────
const WFS_TYPENAME = "ADMINEXPRESS-COG-CARTO.LATEST:commune";
const parisUrl = `https://data.geopf.fr/wfs/ows?${new URLSearchParams({
  SERVICE: "WFS",
  VERSION: "2.0.0",
  REQUEST: "GetFeature",
  TYPENAMES: WFS_TYPENAME,
  OUTPUTFORMAT: "application/json",
  SRSNAME: "EPSG:2154",
  CQL_FILTER: "code_insee='75056'",
})}`;
const parisFetched = await fetchCached(parisUrl, "admin-express-commune-75056.geojson", {
  refresh: refreshRequested,
  accept: /json/,
});
const parisFeature = (JSON.parse(parisFetched.body.toString("utf8")) as FeatureCollection<Polygon | MultiPolygon>)
  .features[0];
if (!parisFeature) throw new Error("commune 75056 introuvable");
const parisPolygons =
  parisFeature.geometry.type === "Polygon" ? [parisFeature.geometry.coordinates] : parisFeature.geometry.coordinates;
let parisAreaM2 = 0;
const parisRings: number[][] = [];
for (const polygon of parisPolygons) {
  polygon.forEach((ring, k) => {
    let twice = 0;
    for (let i = 0; i < ring.length - 1; i++) twice += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    parisAreaM2 += (k === 0 ? 1 : -1) * Math.abs(twice / 2);
    const flat: number[] = [];
    for (const [x, y] of ring) {
      const p = l93ToScene([x, y]);
      flat.push(p.x, p.z);
    }
    parisRings.push(encodeRing(flat));
  });
}

/** Lambert-93 linear scale factor at a point: projected length / ellipsoidal length of a short meridian step. */
function scaleFactor([lon, lat]: readonly [number, number]): number {
  const a = 6_378_137;
  const e2 = 0.006694380022903; // GRS80
  const dLat = 1e-4;
  const phi = (lat * Math.PI) / 180;
  const meridianM = ((a * (1 - e2)) / (1 - e2 * Math.sin(phi) ** 2) ** 1.5) * ((dLat * Math.PI) / 180);
  const [x0, y0] = lonLatToL93([lon, lat - dLat / 2]);
  const [x1, y1] = lonLatToL93([lon, lat + dLat / 2]);
  return Math.hypot(x1 - x0, y1 - y0) / meridianM;
}
const gironde = events.find((event) => event.id === "gironde");
if (!gironde) throw new Error("événement gironde absent");
const [gx0, gz0, gx1, gz1] = gironde.effis.bbox;
const girondeCentre = sceneToLonLat({ x: (gx0 + gx1) / 2, z: (gz0 + gz1) / 2 });

// ── Write ─────────────────────────────────────────────────────────────────────
const story = StorySchema.parse({
  year: YEAR,
  retrievedAt: source.retrievedAt,
  effisDataDate: entry.lastUpdate,
  headline: {
    areaHa: Math.round(entry.areaHaAtLeast30),
    fires: entry.firesAtLeast30,
    allAreaHa: Math.round(entry.areaHa),
    seasonAreaHa,
    previousMax: { year: previous.year, areaHa: Math.round(previous.areaHaAtLeast30) },
    monthlyAreaHa,
  },
  events,
  insurance: source.insurance,
  paris: {
    rings: parisRings,
    areaHa: Math.round(parisAreaM2 / 10_000),
    scaleFactorParis: Number(scaleFactor([2.3488, 48.8534]).toFixed(6)),
    scaleFactorGironde: Number(scaleFactor(girondeCentre).toFixed(6)),
    source: `IGN — ADMIN EXPRESS COG CARTO, commune de Paris (75056), WFS Géoplateforme, couche ${WFS_TYPENAME}`,
  },
});
const monthlySum = monthlyAreaHa.reduce((sum, value) => sum + value, 0);
if (Math.abs(monthlySum - story.headline.areaHa) > 12) {
  throw new Error(`cumul mensuel ${monthlySum} ≠ total ${story.headline.areaHa}`);
}

await writeDataFile("story/story.json", `${JSON.stringify(story)}\n`, {
  title: `Chiffres du récit ${YEAR}`,
  source: "EFFIS (polygones et index publiés par 02-effis), faits sourcés de data/events.json, IGN ADMIN EXPRESS (Paris)",
  sourceUrl: parisUrl,
  ...IGN_OPEN_LICENCE,
  retrievedAt: parisFetched.retrievedAt,
  transformations: [
    "citations de data/events.json vérifiées dans leurs pages sources",
    "groupes de polygones EFFIS recalculés (contiguïté < 1 km entre sommets, ou département et période)",
    "surfaces par mois de première détection (heure de Paris), feux ≥ 30 ha",
    "Paris : Lambert-93 → coordonnées de scène, arrondies à 10 m",
  ],
});
console.log(
  `  ${story.headline.areaHa} ha (≥ 30 ha), précédent maximum ${previous.year} : ${story.headline.previousMax.areaHa} ha ; Paris ${story.paris.areaHa} ha ; k Paris ${story.paris.scaleFactorParis}, k Gironde ${story.paris.scaleFactorGironde}`,
);
