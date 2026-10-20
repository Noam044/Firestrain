import "server-only";
import { cacheLife } from "next/cache";
import outlineJson from "@/public/data/admin/france-contour.json";
import staticCellsJson from "@/public/data/firms/sources-fixes.json";
import { selectRecent, staticCellTest } from "@/lib/data/firms-recent";
import { FirmsStaticCellsSchema, FranceOutlineSchema, type RecentDetections } from "@/lib/data/schemas";
import { l93ToScene } from "@/lib/geo/frame";
import { bboxContains, pointInRings, ringsBBox } from "@/lib/geo/polygon";
import { lonLatToL93 } from "@/lib/geo/projection";

const BBOX = "-5.5,41,10,51.5";
/** 72 hours fit in the last 4 UTC days (today included). */
const DAY_RANGE = 4;
const SOURCES = ["VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"] as const;

const outline = FranceOutlineSchema.parse(outlineJson);
const rings = outline.rings.map((ring) => ({ ring, box: ringsBBox([ring]) }));
const franceBox = ringsBBox(outline.rings);
const staticCells = FirmsStaticCellsSchema.parse(staticCellsJson);

function inFrance(x: number, z: number): boolean {
  if (!bboxContains(franceBox, x, z)) return false;
  return pointInRings(x, z, rings.filter((r) => bboxContains(r.box, x, z)).map((r) => r.ring));
}

/**
 * Last 72 hours of VIIRS near-real-time detections over metropolitan France.
 * The FIRMS key is read here, on the server only; it never reaches the answer,
 * the logs or the browser. Cached for about an hour (FIRMS updates every few hours).
 * Throws on any failure, so that an error is never cached.
 */
export async function getRecentDetections(): Promise<RecentDetections> {
  "use cache";
  cacheLife("hours");
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) throw new Error("FIRMS_MAP_KEY is not set");
  const csvs = await Promise.all(
    SOURCES.map(async (source) => {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${source}/${BBOX}/${DAY_RANGE}`;
      let response: Response;
      try {
        response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      } catch {
        // Fetch errors may quote the URL, hence the key: replaced by a message of our own.
        throw new Error(`FIRMS ${source}: network error`);
      }
      if (!response.ok) throw new Error(`FIRMS ${source}: HTTP ${response.status}`);
      return response.text();
    }),
  );
  return selectRecent(csvs, new Date(), {
    inFrance,
    nearStatic: staticCellTest(staticCells.cells, staticCells.cellMeters),
    lonLatToL93,
    l93ToScene,
  });
}
