import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parisDayOfYear } from "@/lib/data/fires";
import { EffisIndexSchema, EffisYearSchema } from "@/lib/data/schemas";

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(process.cwd(), "public", "data", path), "utf8"));

/** Burnt area since 1 January, day by day (index 0 = 1 January, 366 days). */
function cumulative(fires: readonly { firedate: string; areaHa: number }[]): number[] {
  const perDay = new Array<number>(366).fill(0);
  for (const fire of fires) perDay[Math.min(365, parisDayOfYear(fire.firedate) - 1)] += fire.areaHa;
  let total = 0;
  return perDay.map((area) => Math.round((total += area)));
}

export type YearPace = {
  /** Years averaged (every archive year before the last one). */
  first: number;
  lastPast: number;
  average: number[];
  /** The past year with the most burnt area. */
  record: { year: number; curve: number[] };
  /** The last archive year, for when the live route does not answer. */
  archive: { year: number; curve: number[]; asOf: string };
};

/**
 * The home page's comparison of the current year with the past ones, computed
 * when the site is built from the published EFFIS archive (every fire, by its
 * day of first detection, Paris time).
 */
export function yearPace(): YearPace {
  const index = EffisIndexSchema.parse(readJson("effis/index.json"));
  const curves = index.years.map((entry) => {
    const file = EffisYearSchema.parse(readJson(entry.file));
    return { year: file.year, curve: cumulative(file.fires), asOf: entry.lastUpdate };
  });
  const past = curves.slice(0, -1);
  const last = curves.at(-1)!;
  const average = Array.from({ length: 366 }, (_, day) =>
    Math.round(past.reduce((sum, y) => sum + y.curve[day], 0) / past.length),
  );
  const record = past.reduce((best, y) => (y.curve[365] > best.curve[365] ? y : best));
  return {
    first: past[0].year,
    lastPast: past.at(-1)!.year,
    average,
    record: { year: record.year, curve: record.curve },
    archive: { year: last.year, curve: last.curve, asOf: last.asOf },
  };
}
