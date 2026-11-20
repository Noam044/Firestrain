/**
 * Douglas–Peucker simplification of one closed ring, in planar units (Lambert-93
 * metres). Used by the live EFFIS route, where mapshaper (topology-aware, used
 * by the data scripts) would be too heavy; a ring never drops below 3 distinct vertices.
 */
export function simplifyRing(ring: readonly (readonly number[])[], tolerance: number): number[][] {
  const n = ring.length;
  if (n <= 4) return ring.map(([x, y]) => [x, y]);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  const squared = tolerance * tolerance;
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = ring[first];
    const [bx, by] = ring[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    let worst = -1;
    let worstDistance = squared;
    for (let k = first + 1; k < last; k++) {
      const [px, py] = ring[k];
      // Distance to the segment (to the point itself when the ring closes on it).
      const t = length > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const distance = ex * ex + ey * ey;
      if (distance > worstDistance) {
        worstDistance = distance;
        worst = k;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([first, worst], [worst, last]);
    }
  }
  const out = ring.filter((_, k) => keep[k]).map(([x, y]) => [x, y]);
  if (out.length >= 4) return out;
  // A small ring reduced to a sliver keeps a triangle spread along it instead.
  const step = Math.max(1, Math.floor((n - 1) / 3));
  return [ring[0], ring[step], ring[Math.min(n - 2, 2 * step)], ring[n - 1]].map(([x, y]) => [x, y]);
}
