import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decodeFire, type DecodedFire } from "@/lib/data/fires";
import { EffisIndexSchema, EffisYearSchema } from "@/lib/data/schemas";
import { getRecentFires } from "./effis-recent";

const readJson = (path: string): unknown => JSON.parse(readFileSync(join(process.cwd(), "public", "data", path), "utf8"));

/**
 * One fire by its EFFIS id, for link previews: in the archive year given by
 * the address, else in the live twelve months (shared cache), else in the last
 * two archive years. Null when it is nowhere.
 */
export async function findFire(id: number, year: number | null): Promise<DecodedFire | null> {
  const index = EffisIndexSchema.parse(readJson("effis/index.json"));
  const inYear = (y: number) => {
    const entry = index.years.find((e) => e.year === y);
    if (!entry) return null;
    const raw = EffisYearSchema.parse(readJson(entry.file)).fires.find((fire) => fire.id === id);
    return raw ? decodeFire(raw) : null;
  };
  if (year !== null) return inYear(year);
  try {
    const raw = (await getRecentFires()).fires.find((fire) => fire.id === id);
    if (raw) return decodeFire(raw);
  } catch {
    // EFFIS did not answer: the archive files still know most fires.
  }
  for (const entry of index.years.slice(-2).reverse()) {
    const fire = inYear(entry.year);
    if (fire) return fire;
  }
  return null;
}
