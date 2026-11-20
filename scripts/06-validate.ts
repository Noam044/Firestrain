/**
 * 06-validate — checks every published file and confronts the pipeline's totals
 * with official statistics and published figures.
 *
 *   1. each file listed in public/data/manifest.json: size, sha256, Zod schema;
 *      every file under public/data must be listed
 *   2. EFFIS: metropolitan totals (fires ≥ 30 ha) vs the official EFFIS country
 *      statistics; every gap must be explained by polygons outside the metropole
 *   3. EFFIS vs BDIFF per year (informative: two methods, never added up)
 *   4. EFFIS ↔ BDIFF automatic links
 *   5. press figures (data/press-figures.json) vs the data
 *
 * Writes docs/VALIDATION_REPORT.md; exits with an error on any failure.
 * Usage: node scripts/06-validate.ts
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { gunzipSync } from "node:zlib";
import { z } from "zod";
import { BYTES_PER_DETECTION } from "../lib/data/firms-codec.ts";
import { formatDate, formatInteger } from "../lib/format.ts";
import {
  BdiffAnnualSchema,
  BdiffCommunesSchema,
  BdiffMatchesSchema,
  BordersSchema,
  Departements2DSchema,
  EffisIndexSchema,
  EffisStatsSchema,
  EffisYearSchema,
  FirmsIndexSchema,
  FirmsStaticCellsSchema,
  FranceOutlineSchema,
  NeighboursSchema,
  ManifestSchema,
  EventsSchema,
  TerrainMetaSchema,
} from "../lib/data/schemas.ts";
import { RAW_DIR } from "./lib/http.ts";
import { PUBLIC_DATA_DIR } from "./lib/manifest.ts";

const ROOT = join(import.meta.dirname, "..");
const problems: string[] = [];
const report: string[] = [];
const ha = (value: number) => `${formatInteger(value)} ha`;
const signed = (value: number) => (value > 0 ? `+${formatInteger(value)}` : value < 0 ? `−${formatInteger(-value)}` : "0");
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8")) as unknown;

// ── 1. Files, checksums, schemas ─────────────────────────────────────────────
const manifest = ManifestSchema.parse(await readJson(join(PUBLIC_DATA_DIR, "manifest.json")));
const SCHEMAS: [RegExp, z.ZodType][] = [
  [/^terrain\/dem-\d+m\.json$/, TerrainMetaSchema],
  [/^admin\/departements-lignes\.json$/, BordersSchema],
  [/^admin\/france-contour\.json$/, FranceOutlineSchema],
  [/^admin\/voisins\.json$/, NeighboursSchema],
  [/^admin\/departements-2d\.json$/, Departements2DSchema],
  [/^effis\/fires-\d{4}\.json$/, EffisYearSchema],
  [/^effis\/index\.json$/, EffisIndexSchema],
  [/^effis\/stats\.json$/, EffisStatsSchema],
  [/^bdiff\/annuel\.json$/, BdiffAnnualSchema],
  [/^bdiff\/communes\.json$/, BdiffCommunesSchema],
  [/^bdiff\/rapprochements\.json$/, BdiffMatchesSchema],
  [/^firms\/index\.json$/, FirmsIndexSchema],
  [/^firms\/sources-fixes\.json$/, FirmsStaticCellsSchema],
  [/^events\/events\.json$/, EventsSchema],
];
const BINARY = /^(terrain\/dem-\d+m|firms\/detections-\d{4})\.bin$/;
/** Base-map images (09-basemaps): checked for the JPEG signature. */
const JPEG = /^fonds\/[a-z]+-france\.jpg$/;

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? listFiles(join(dir, e.name)) : Promise.resolve([join(dir, e.name)]))),
  );
  return nested.flat();
}
const onDisk = (await listFiles(PUBLIC_DATA_DIR)).map((f) => relative(PUBLIC_DATA_DIR, f)).filter((f) => f !== "manifest.json");
for (const path of onDisk) if (!manifest.files[path]) problems.push(`${path} : absent du manifest`);

let checked = 0;
for (const [path, entry] of Object.entries(manifest.files)) {
  const bytes = await readFile(join(PUBLIC_DATA_DIR, path)).catch(() => null);
  if (!bytes) {
    problems.push(`${path} : listé dans le manifest mais absent`);
    continue;
  }
  if (bytes.length !== entry.bytes) problems.push(`${path} : taille ${bytes.length} ≠ ${entry.bytes} (manifest)`);
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256) problems.push(`${path} : sha256 différent du manifest`);
  if (BINARY.test(path)) {
    checked++;
    continue;
  }
  if (JPEG.test(path)) {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) problems.push(`${path} : pas une image JPEG`);
    else checked++;
    continue;
  }
  const schema = SCHEMAS.find(([pattern]) => pattern.test(path))?.[1];
  if (!schema) {
    problems.push(`${path} : aucun schéma de validation`);
    continue;
  }
  const result = schema.safeParse(JSON.parse(bytes.toString("utf8")));
  if (!result.success) problems.push(`${path} : ${result.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ")}`);
  else checked++;
}
// FIRMS binaries: decoded size must match the count announced in the index.
const firmsIndex = FirmsIndexSchema.parse(await readJson(join(PUBLIC_DATA_DIR, "firms/index.json")));
for (const entry of firmsIndex.years) {
  const bytes = gunzipSync(await readFile(join(PUBLIC_DATA_DIR, entry.file)));
  if (bytes.length !== entry.count * BYTES_PER_DETECTION) problems.push(`${entry.file} : taille décodée incohérente avec ${entry.count} détections`);
}

report.push(
  "## 1. Fichiers publiés",
  "",
  `${checked} fichiers sur ${Object.keys(manifest.files).length} conformes (taille, sha256 et schéma Zod) ; ${onDisk.length} fichiers présents dans \`public/data\`.`,
  "",
);

// ── 2. EFFIS: pipeline vs official statistics ────────────────────────────────
const index = EffisIndexSchema.parse(await readJson(join(PUBLIC_DATA_DIR, "effis/index.json")));
const stats = EffisStatsSchema.parse(await readJson(join(PUBLIC_DATA_DIR, "effis/stats.json")));

// Polygons outside the metropole, from the raw API pages kept by 02-effis.
const RawRecord = z.object({
  centroid: z.object({ coordinates: z.array(z.number()) }),
  province: z.string().nullable(),
  firedate: z.string(),
  area_ha: z.number(),
});
const rawPages = (await readdir(RAW_DIR)).filter((f) => /^effis-fr-\d+\.json$/.test(f));
const outside = new Map<number, { area: number; places: Set<string> }>();
for (const page of rawPages) {
  const { results } = z.object({ results: z.array(RawRecord) }).parse(await readJson(join(RAW_DIR, page)));
  for (const r of results) {
    const [lon, lat] = r.centroid.coordinates;
    const metro = lon >= -5.5 && lon <= 10 && lat >= 41 && lat <= 51.5;
    if (metro || r.area_ha < 30) continue;
    const year = Number(r.firedate.slice(0, 4));
    const entry = outside.get(year) ?? { area: 0, places: new Set<string>() };
    entry.area += r.area_ha;
    entry.places.add(r.province ?? "?");
    outside.set(year, entry);
  }
}

report.push(
  "## 2. EFFIS : totaux du pipeline et statistiques officielles",
  "",
  "Pipeline : polygones de France métropolitaine de 30 ha ou plus, année de la date publiée par EFFIS (heure locale).",
  "Officiel : API du portail EFFIS Statistics, pays FRA (inclut l’outre-mer).",
  "",
  "| Année | Pipeline (métropole) | EFFIS officiel (FRA) | Écart | Hors métropole | Résiduel | Explication |",
  "|---|---:|---:|---:|---:|---:|---|",
);
for (const official of stats.annual) {
  const ours = index.years.find((y) => y.year === official.year);
  if (!ours) {
    problems.push(`EFFIS ${official.year} : année absente du pipeline`);
    continue;
  }
  const gap = Math.round(official.areaHa - ours.areaHaAtLeast30);
  const dom = outside.get(official.year);
  const residual = gap - Math.round(dom?.area ?? 0);
  const explanation =
    gap === 0 ? "identique" : residual === 0 ? `polygone(s) hors métropole : ${[...(dom?.places ?? [])].join(", ")}` : "**non expliqué**";
  if (residual !== 0) problems.push(`EFFIS ${official.year} : écart de ${gap} ha non expliqué (résiduel ${residual} ha)`);
  report.push(
    `| ${official.year} | ${ha(ours.areaHaAtLeast30)} | ${ha(official.areaHa)} | ${signed(gap)} | ${dom ? ha(dom.area) : "—"} | ${signed(residual)} | ${explanation} |`,
  );
}
report.push("");

// ── 3. EFFIS vs BDIFF ────────────────────────────────────────────────────────
const bdiff = BdiffAnnualSchema.parse(await readJson(join(PUBLIC_DATA_DIR, "bdiff/annuel.json")));
report.push(
  "## 3. EFFIS et BDIFF par année (informatif)",
  "",
  "EFFIS cartographie par satellite les surfaces brûlées (toute végétation) ; la BDIFF recense les feux déclarés par les services d’incendie (type F), avec des surfaces souvent estimées. Les deux ne s’additionnent pas et ne coïncident pas.",
  "",
  "| Année | EFFIS ≥ 30 ha | EFFIS tous polygones | BDIFF (feux déclarés) | BDIFF / EFFIS ≥ 30 ha |",
  "|---|---:|---:|---:|---:|",
);
for (const year of index.years) {
  const declared = bdiff.years.find((y) => y.year === year.year);
  report.push(
    `| ${year.year} | ${ha(year.areaHaAtLeast30)} | ${ha(year.areaHa)} | ${declared ? `${ha(declared.areaHa)} (${formatInteger(declared.fires)} feux)` : "non diffusé"} | ${declared && year.areaHaAtLeast30 > 0 ? `${formatInteger(Math.round((declared.areaHa / year.areaHaAtLeast30) * 100))} %` : "—"} |`,
  );
}
report.push("");

// ── 4. Automatic links ───────────────────────────────────────────────────────
const matches = BdiffMatchesSchema.parse(await readJson(join(PUBLIC_DATA_DIR, "bdiff/rapprochements.json")));
report.push(
  "## 4. Rapprochements EFFIS ↔ BDIFF",
  "",
  `Règle : ${matches.rule.description}`,
  "",
  "| Année | Polygones EFFIS | Univoques | Ambigus (non liés) | Sans candidat |",
  "|---|---:|---:|---:|---:|",
  ...matches.years.map((y) => `| ${y.year} | ${y.polygons} | ${y.matched} | ${y.ambiguous} | ${y.noCandidate} |`),
  "",
  "Les polygones sans candidat sont surtout de petites surfaces (dont les brûlages hivernaux des Pyrénées) sans fiche BDIFF de 1 ha ou plus à proximité, ou des fiches dont la commune a changé de code INSEE (communes nouvelles).",
  "",
);

// ── 5. Press figures ─────────────────────────────────────────────────────────
const Press = z.object({
  figures: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      value: z.number(),
      approximate: z.boolean(),
      unit: z.literal("ha"),
      quote: z.string(),
      source: z.string(),
      url: z.url(),
      published: z.iso.date(),
      compareWith: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("effis-year"), year: z.number().int() }),
        z.object({ kind: z.literal("effis-fire"), year: z.number().int(), fireId: z.number().int() }),
      ]),
    }),
  ),
});
const press = Press.parse(await readJson(join(ROOT, "data/press-figures.json")));
report.push("## 5. Chiffres de presse", "");
for (const figure of press.figures) {
  report.push(
    `### ${figure.label}`,
    "",
    `> « ${figure.quote} » — ${figure.source}, ${formatDate(figure.published)} ([lien](${figure.url}))`,
    "",
  );
  if (figure.compareWith.kind === "effis-year") {
    const { year } = figure.compareWith;
    const entry = index.years.find((y) => y.year === year);
    const fires = EffisYearSchema.parse(await readJson(join(PUBLIC_DATA_DIR, `effis/fires-${year}.json`))).fires;
    // Season 1 June – 30 September, by the local date published by EFFIS.
    const parisDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" });
    const inSeason = fires.filter((f) => {
      const day = parisDate.format(new Date(f.firedate));
      return day >= `${year}-06-01` && day <= `${year}-09-30`;
    });
    const season30 = inSeason.filter((f) => f.areaHa >= 30).reduce((sum, f) => sum + f.areaHa, 0);
    if (!entry) problems.push(`presse ${figure.id} : année ${year} absente`);
    else
      report.push(
        `- EFFIS, année civile ${year}, feux ≥ 30 ha : **${ha(entry.areaHaAtLeast30)}** (${signed(entry.areaHaAtLeast30 - figure.value)} ha par rapport à la presse) ; tous polygones : ${ha(entry.areaHa)}.`,
        `- EFFIS, saison du 1er juin au 30 septembre, feux ≥ 30 ha : ${ha(season30)}.`,
        `- Explication : le chiffre de presse (arrondi) correspond au total de l’année civile, pas à l’été ; EFFIS compte toutes les surfaces brûlées, pas seulement la forêt.`,
        "",
      );
  } else {
    const { year, fireId } = figure.compareWith;
    const fire = EffisYearSchema.parse(await readJson(join(PUBLIC_DATA_DIR, `effis/fires-${year}.json`))).fires.find(
      (f) => f.id === fireId,
    );
    if (!fire) problems.push(`presse ${figure.id} : polygone EFFIS ${fireId} absent`);
    else
      report.push(
        `- EFFIS, polygone ${fire.id} (${fire.commune}, ${fire.province}) : **${ha(fire.areaHa)}**, mis à jour le ${formatDate(fire.lastUpdate)} (${signed(fire.areaHa - figure.value)} ha, soit ${formatInteger(Math.round(((fire.areaHa - figure.value) / figure.value) * 100))} %).`,
        "- Explication partielle : le chiffre de presse est arrondi et ne précise pas s’il s’agit de surface parcourue ou brûlée ; EFFIS cartographie la surface brûlée détectée par satellite. À confronter en phase 4 aux communiqués de la préfecture de la Gironde.",
        "",
      );
  }
}

// ── 6. FIRMS ────────────────────────────────────────────────────────────────
report.push(
  "## 6. Détections FIRMS (années civiles)",
  "",
  "Anomalies thermiques VIIRS : des points chauds, jamais convertis en surfaces. 2026 combine trois satellites (S-NPP, NOAA-20, NOAA-21) ; les années précédentes viennent du seul S-NPP : les nombres ne se comparent pas entre ces deux périodes.",
  "",
  "| Année | Jusqu’au | Détections | Satellites | Produits |",
  "|---|---|---:|---|---|",
  ...firmsIndex.years.map(
    (y) => `| ${y.year} | ${formatDate(y.lastDate)} | ${formatInteger(y.count)} | ${y.satellites.join(", ")} | ${y.products.join(" ; ")} |`,
  ),
  "",
);

// ── Write ────────────────────────────────────────────────────────────────────
const header = [
  "# Rapport de validation des données",
  "",
  `Généré par \`scripts/06-validate.ts\` le ${formatDate(new Date())} à partir de \`public/data\` (manifest mis à jour le ${formatDate(manifest.updatedAt)}).`,
  "",
  problems.length === 0
    ? "**Résultat : aucun problème.**"
    : `**Résultat : ${problems.length} problème(s).**\n\n${problems.map((p) => `- ${p}`).join("\n")}`,
  "",
];
await writeFile(join(ROOT, "docs/VALIDATION_REPORT.md"), `${[...header, ...report].join("\n")}\n`);
console.log(problems.length === 0 ? "Validation : aucun problème." : `Validation : ${problems.length} problème(s)`);
for (const problem of problems) console.log(`  - ${problem}`);
if (problems.length > 0) process.exitCode = 1;
