import { bboxContains, pointInRings } from "../geo/polygon.ts";
import { decodeRing } from "../geo/rings.ts";
import type { EffisFire } from "./schemas.ts";

export type DecodedFire = EffisFire & {
  /** Per polygon: [outer ring, ...holes], flat [x, z, …] in scene km. */
  shapes: Float32Array[][];
  /** All rings together (even-odd), for hit testing. */
  rings: Float32Array[];
  /** Where the fire's marker stands: centroid of its largest outer ring, scene km. */
  center: [x: number, z: number];
};

/** A fire placed in the window shown (lib/span.ts). */
export type SpanFire = DecodedFire & {
  /** Day of the window of its first detection (1 = first day of the window). */
  day: number;
  /** Month of the window of its first detection (0 = oldest). */
  monthIndex: number;
  /** Whole days from its first detection to the date of the data (live view), null in the archives. */
  ageDays: number | null;
};

/** Centroid and area (shoelace) of a flat ring. */
function ringCentroid(ring: Float32Array): { x: number; z: number; area: number } {
  let twiceArea = 0;
  let cx = 0;
  let cz = 0;
  const n = ring.length / 2;
  for (let k = 0; k < n; k++) {
    const x0 = ring[2 * k];
    const z0 = ring[2 * k + 1];
    const x1 = ring[(2 * k + 2) % ring.length];
    const z1 = ring[(2 * k + 3) % ring.length];
    const cross = x0 * z1 - x1 * z0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cz += (z0 + z1) * cross;
  }
  if (Math.abs(twiceArea) < 1e-9) return { x: ring[0], z: ring[1], area: 0 };
  return { x: cx / (3 * twiceArea), z: cz / (3 * twiceArea), area: Math.abs(twiceArea) / 2 };
}

export function decodeFire(fire: EffisFire): DecodedFire {
  const shapes = fire.polygons.map((polygon) => polygon.map(decodeRing));
  let best = { x: (fire.bbox[0] + fire.bbox[2]) / 2, z: (fire.bbox[1] + fire.bbox[3]) / 2, area: -1 };
  for (const shape of shapes) {
    const candidate = ringCentroid(shape[0]);
    if (candidate.area > best.area) best = candidate;
  }
  return { ...fire, shapes, rings: shapes.flat(), center: [best.x, best.z] };
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

