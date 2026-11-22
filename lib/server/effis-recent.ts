import "server-only";
import { cacheLife } from "next/cache";
import {
  EFFIS_API,
  RawPageSchema,
  effisFire,
  encodeL93Polygons,
  isMetropolitan,
  recordPolygons,
  type RawRecord,
} from "@/lib/data/effis-records";
import { RecentFiresSchema, type RecentFires } from "@/lib/data/schemas";
import { lonLatToL93 } from "@/lib/geo/projection";
import { simplifyRing } from "@/lib/geo/simplify";
import { recentSpan, spanStartDate } from "@/lib/span";

const PAGE_SIZE = 500;
/** Same tolerance as the archive files (02-effis), in Lambert-93 metres. */
const SIMPLIFY_M = 40;

async function fetchPage(from: string, offset: number) {
  const url = `${EFFIS_API}?country=FR&firedate__gte=${from}&ordering=id&limit=${PAGE_SIZE}&offset=${offset}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`EFFIS: HTTP ${response.status}`);
  return RawPageSchema.parse(await response.json());
}

function toFire(record: RawRecord) {
  const polygons = recordPolygons(record).map((rings) =>
    rings.map((ring) => simplifyRing(ring.map(([lon, lat]) => [...lonLatToL93([lon, lat])]), SIMPLIFY_M)),
  );
  return effisFire(record, encodeL93Polygons(polygons));
}

/**
 * Burnt areas of metropolitan France first detected since the 1st of the month
 * eleven months ago (Paris), straight from the EFFIS API. Cached for about an
 * hour (EFFIS updates its outlines a few times a day). Throws on any failure,
 * so that an error is never cached.
 */
export async function getRecentFires(): Promise<RecentFires> {
  // Remote: shared by every server instance, so a cold instance does not query EFFIS again.
  "use cache: remote";
  cacheLife("hours");
  const generatedAt = new Date().toISOString();
  const from = spanStartDate(recentSpan(generatedAt));
  const first = await fetchPage(from, 0);
  const rest = await Promise.all(
    Array.from({ length: Math.ceil(first.count / PAGE_SIZE) - 1 }, (_, k) => fetchPage(from, (k + 1) * PAGE_SIZE)),
  );
  const records = [first, ...rest].flatMap((page) => page.results);
  if (records.length !== first.count) throw new Error(`EFFIS: expected ${first.count} records, got ${records.length}`);
  const fires = records
    .filter(isMetropolitan)
    .map(toFire)
    .filter((fire) => fire.polygons.length > 0)
    .sort((a, b) => a.firedate.localeCompare(b.firedate));
  return RecentFiresSchema.parse({ generatedAt, from, encoding: "scene-10m-delta", fires });
}
