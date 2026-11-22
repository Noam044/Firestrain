import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeFire } from "@/lib/data/fires";
import { EffisIndexSchema, EffisYearSchema } from "@/lib/data/schemas";
import { SCENE_SIZE } from "@/lib/geo/frame";
import { slugify } from "@/lib/slug";

/**
 * The département pages' data, computed once when the site is built from the
 * published EFFIS archive (one file per year since 2006) and the outlines of
 * the 2D map: totals, year by year, the largest fires and where each fire sits.
 */

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(process.cwd(), "public", "data", path), "utf8"));

export type DepartementFire = { id: number; year: number; commune: string; firedate: string; areaHa: number };
export type DepartementDot = { x: number; y: number; areaHa: number; year: number };
export type DepartementYear = { year: number; fires: number; areaHa: number };
export type Departement = {
  code: string;
  nom: string;
  slug: string;
  /** Outline in the 2D map's units (Lambert-93 kilometres), and the box around it. */
  path: string;
  viewBox: [number, number, number, number];
  fires: number;
  areaHa: number;
  years: DepartementYear[];
  largest: DepartementFire[];
  dots: DepartementDot[];
};

type Outline = { code: string; nom: string; d: string };

function outlineBox(d: string): [number, number, number, number] {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let k = 0; k + 1 < numbers.length; k += 2) {
    x0 = Math.min(x0, numbers[k]);
    x1 = Math.max(x1, numbers[k]);
    y0 = Math.min(y0, numbers[k + 1]);
    y1 = Math.max(y1, numbers[k + 1]);
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
  return [x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad];
}

let cache: { list: Departement[]; dataDate: string; years: number[] } | null = null;

function build() {
  if (cache) return cache;
  const index = EffisIndexSchema.parse(readJson("effis/index.json"));
  const outlines = (readJson("admin/departements-2d.json") as { features: Outline[] }).features;
  const years = index.years.map((y) => y.year);
  // Keyed by slug: EFFIS writes "Côtes-d’Armor", the outlines "Côtes-d'Armor".
  const bySlug = new Map<string, Departement>(
    outlines.map((o) => [
      slugify(o.nom),
      {
        code: o.code,
        nom: o.nom,
        slug: slugify(o.nom),
        path: o.d,
        viewBox: outlineBox(o.d),
        fires: 0,
        areaHa: 0,
        years: years.map((year) => ({ year, fires: 0, areaHa: 0 })),
        largest: [],
        dots: [],
      },
    ]),
  );
  for (const entry of index.years) {
    const file = EffisYearSchema.parse(readJson(entry.file));
    for (const raw of file.fires) {
      const departement = bySlug.get(slugify(raw.province));
      if (!departement) continue;
      const fire = decodeFire(raw);
      const year = departement.years.find((y) => y.year === file.year)!;
      year.fires += 1;
      year.areaHa += fire.areaHa;
      departement.fires += 1;
      departement.areaHa += fire.areaHa;
      departement.largest.push({ id: fire.id, year: file.year, commune: fire.commune, firedate: fire.firedate, areaHa: fire.areaHa });
      departement.dots.push({
        x: fire.center[0] + SCENE_SIZE.width / 2,
        y: fire.center[1] + SCENE_SIZE.depth / 2,
        areaHa: fire.areaHa,
        year: file.year,
      });
    }
  }
  const list = [...bySlug.values()].map((d) => ({
    ...d,
    largest: d.largest.sort((a, b) => b.areaHa - a.areaHa).slice(0, 10),
    // Largest first, so the small fires are drawn on top and stay visible.
    dots: d.dots.sort((a, b) => b.areaHa - a.areaHa),
  }));
  const dataDate = index.years.reduce((latest, y) => (y.lastUpdate > latest ? y.lastUpdate : latest), "");
  cache = { list, dataDate, years };
  return cache;
}

/** Every département, most burnt first. */
export function listDepartements(): Departement[] {
  return [...build().list].sort((a, b) => b.areaHa - a.areaHa || a.nom.localeCompare(b.nom, "fr"));
}

export function departementBySlug(slug: string): Departement | null {
  return build().list.find((d) => d.slug === slug) ?? null;
}

/** Latest update of the archive files, and their first and last years. */
export function archiveInfo() {
  const { dataDate, years } = build();
  return { dataDate, first: years[0], last: years.at(-1)! };
}
