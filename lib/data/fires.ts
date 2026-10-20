import { bboxContains, pointInRings } from "../geo/polygon.ts";
import { decodeRing } from "../geo/rings.ts";
import type { EffisFire } from "./schemas.ts";

export type DecodedFire = EffisFire & {
  /** Per polygon: [outer ring, ...holes], flat [x, z, …] in scene km. */
  shapes: Float32Array[][];
  /** All rings together (even-odd), for hit testing. */
  rings: Float32Array[];
};

export function decodeFire(fire: EffisFire): DecodedFire {
  const shapes = fire.polygons.map((polygon) => polygon.map(decodeRing));
  return { ...fire, shapes, rings: shapes.flat() };
}

/** Fire under a scene point; when outlines overlap, the smallest one wins. */
export function findFireAt(fires: readonly DecodedFire[], x: number, z: number): DecodedFire | null {
  let best: DecodedFire | null = null;
  for (const fire of fires) {
    if (!bboxContains(fire.bbox, x, z) || !pointInRings(x, z, fire.rings)) continue;
    if (!best || fire.areaHa < best.areaHa) best = fire;
  }
  return best;
}

const parisDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar year of an instant, in Europe/Paris. */
export function parisYear(iso: string): number {
  return Number(parisDate.format(new Date(iso)).slice(0, 4));
}

/** Day of the year (1 = 1 January) of an instant, in Europe/Paris. */
export function parisDayOfYear(iso: string): number {
  const [year, month, day] = parisDate.format(new Date(iso)).split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
}

/** Timeline day of a fire's first detection: 1 = 1 June (or earlier), capped at 255. */
export function fireTimelineDay(fire: Pick<EffisFire, "firedate">): number {
  const year = parisYear(fire.firedate);
  const mayEnd = parisDayOfYear(`${year}-05-31T12:00:00Z`);
  return Math.min(255, Math.max(1, parisDayOfYear(fire.firedate) - mayEnd));
}
