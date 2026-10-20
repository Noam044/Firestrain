/**
 * 07-events — sourced facts attached to fires, from the hand-curated
 * data/events.json, shown in the panel of the fires concerned.
 *
 * - every quote of data/events.json must appear in its source page (fetched and cached);
 * - EFFIS polygons of each event are regrouped by the rule written in the file
 *   (contiguity or department + period); the expected ids must match.
 *
 * Output: events/events.json
 * Usage: node scripts/07-events.ts [--refresh]   (run 02-effis first)
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeFire, type DecodedFire } from "../lib/data/fires.ts";
import {
  EffisYearSchema,
  EventsSchema,
  StorySourceSchema,
  type Events,
  type StoryFact,
} from "../lib/data/schemas.ts";
import { fetchCached, refreshRequested } from "./lib/http.ts";
import { PUBLIC_DATA_DIR, writeDataFile } from "./lib/manifest.ts";

const YEAR = 2026;
const ROOT = join(import.meta.dirname, "..");

const source = StorySourceSchema.parse(JSON.parse(await readFile(join(ROOT, "data/events.json"), "utf8")));
const effisYear = EffisYearSchema.parse(
  JSON.parse(await readFile(join(PUBLIC_DATA_DIR, `effis/fires-${YEAR}.json`), "utf8")),
);
const fires = effisYear.fires.map(decodeFire);
const byId = new Map(fires.map((fire) => [fire.id, fire]));
const parisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });
const localDate = (fire: DecodedFire) => parisDate.format(new Date(fire.firedate));

console.log(`Faits sourcés ${YEAR}`);

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

const events: Events["events"] = source.events.map((event) => {
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
    },
    facts: event.facts,
  };
});

// ── Write ─────────────────────────────────────────────────────────────────────
const output = EventsSchema.parse({ year: YEAR, retrievedAt: source.retrievedAt, events, insurance: source.insurance });
await writeDataFile("events/events.json", `${JSON.stringify(output)}\n`, {
  title: `Faits sourcés sur les feux de ${YEAR}`,
  source: "Communiqués des préfectures et de France Assureurs (data/events.json), polygones EFFIS (02-effis)",
  sourceUrl: "https://github.com/Noam044/Firestrain/blob/main/data/events.json",
  licence: "Citations courtes de communiqués publics ; polygones EFFIS sous CC BY 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
  retrievedAt: `${source.retrievedAt}T00:00:00.000Z`,
  transformations: [
    "citations de data/events.json vérifiées dans leurs pages sources",
    "groupes de polygones EFFIS recalculés (contiguïté < 1 km entre sommets, ou département et période)",
  ],
});
console.log(`  ${events.length} événements, ${facts.length} faits`);
