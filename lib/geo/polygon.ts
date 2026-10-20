/**
 * Planar polygon predicates on flat rings [x0, y0, x1, y1, …] (open or closed).
 * A polygon set is a list of rings filled with the even-odd rule, so holes and
 * multipolygon parts need no special handling.
 */

export type FlatRing = ArrayLike<number>;
export type BBox = [minX: number, minY: number, maxX: number, maxY: number];

export function ringsBBox(rings: readonly FlatRing[]): BBox {
  const box: BBox = [Infinity, Infinity, -Infinity, -Infinity];
  for (const ring of rings) {
    for (let k = 0; k < ring.length; k += 2) {
      if (ring[k] < box[0]) box[0] = ring[k];
      if (ring[k + 1] < box[1]) box[1] = ring[k + 1];
      if (ring[k] > box[2]) box[2] = ring[k];
      if (ring[k + 1] > box[3]) box[3] = ring[k + 1];
    }
  }
  return box;
}

export function bboxesOverlap(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

export function bboxContains(box: BBox, x: number, y: number): boolean {
  return x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
}

/** Even-odd point-in-polygon test over all rings. */
export function pointInRings(x: number, y: number, rings: readonly FlatRing[]): boolean {
  let inside = false;
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = ring[2 * i];
      const yi = ring[2 * i + 1];
      const xj = ring[2 * j];
      const yj = ring[2 * j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

const orient = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) =>
  (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);

const onSegment = (ax: number, ay: number, bx: number, by: number, px: number, py: number) =>
  Math.min(ax, bx) <= px && px <= Math.max(ax, bx) && Math.min(ay, by) <= py && py <= Math.max(ay, by);

/** Closed-segment intersection, touching and collinear overlaps included. */
export function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = orient(cx, cy, dx, dy, ax, ay);
  const d2 = orient(cx, cy, dx, dy, bx, by);
  const d3 = orient(ax, ay, bx, by, cx, cy);
  const d4 = orient(ax, ay, bx, by, dx, dy);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return (
    (d1 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) ||
    (d2 === 0 && onSegment(cx, cy, dx, dy, bx, by)) ||
    (d3 === 0 && onSegment(ax, ay, bx, by, cx, cy)) ||
    (d4 === 0 && onSegment(ax, ay, bx, by, dx, dy))
  );
}

function boundariesCross(a: readonly FlatRing[], b: readonly FlatRing[], bBox: BBox): boolean {
  for (const ra of a) {
    const na = ra.length / 2;
    for (let i = 0; i < na; i++) {
      const j = (i + 1) % na;
      const ax = ra[2 * i], ay = ra[2 * i + 1], bx = ra[2 * j], by = ra[2 * j + 1];
      if (Math.max(ax, bx) < bBox[0] || Math.min(ax, bx) > bBox[2]) continue;
      if (Math.max(ay, by) < bBox[1] || Math.min(ay, by) > bBox[3]) continue;
      for (const rb of b) {
        const nb = rb.length / 2;
        for (let k = 0; k < nb; k++) {
          const l = (k + 1) % nb;
          if (segmentsIntersect(ax, ay, bx, by, rb[2 * k], rb[2 * k + 1], rb[2 * l], rb[2 * l + 1])) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * True when two polygon sets share area or boundary. Without crossing edges,
 * each ring lies wholly inside or outside the other set, so testing one vertex
 * per ring settles containment.
 */
export function polygonsIntersect(a: readonly FlatRing[], b: readonly FlatRing[]): boolean {
  const aBox = ringsBBox(a);
  const bBox = ringsBBox(b);
  if (!bboxesOverlap(aBox, bBox)) return false;
  for (const ring of a) if (ring.length >= 2 && pointInRings(ring[0], ring[1], b)) return true;
  for (const ring of b) if (ring.length >= 2 && pointInRings(ring[0], ring[1], a)) return true;
  return boundariesCross(a, b, bBox);
}
