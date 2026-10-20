/**
 * Compact encoding of fire outlines: scene coordinates (km) rounded to 10 m,
 * stored as integers and delta-encoded per ring, which keeps the published
 * JSON small. Rings are open (the closing vertex is implicit).
 */

import type { FlatRing } from "./polygon.ts";

/** One integer step, in scene km. */
export const RING_STEP_KM = 0.01;

/** Scene-km ring (open or closed) → delta-encoded integers; repeated vertices are dropped. */
export function encodeRing(ring: FlatRing): number[] {
  const n = ring.length / 2;
  const closed = n > 1 && ring[0] === ring[2 * n - 2] && ring[1] === ring[2 * n - 1];
  const out: number[] = [];
  let px = 0;
  let pz = 0;
  for (let k = 0; k < (closed ? n - 1 : n); k++) {
    const ix = Math.round(ring[2 * k] / RING_STEP_KM);
    const iz = Math.round(ring[2 * k + 1] / RING_STEP_KM);
    if (out.length > 0 && ix === px && iz === pz) continue;
    out.push(ix - px, iz - pz);
    px = ix;
    pz = iz;
  }
  return out;
}

export function decodeRing(deltas: readonly number[]): Float32Array {
  const out = new Float32Array(deltas.length);
  let ix = 0;
  let iz = 0;
  for (let k = 0; k < deltas.length; k += 2) {
    ix += deltas[k];
    iz += deltas[k + 1];
    out[k] = ix * RING_STEP_KM;
    out[k + 1] = iz * RING_STEP_KM;
  }
  return out;
}

/** Polygons → rings → deltas, flattened into one even-odd ring list. */
export function decodePolygons(polygons: readonly (readonly (readonly number[])[])[]): Float32Array[] {
  return polygons.flatMap((polygon) => polygon.map(decodeRing));
}
