/**
 * Extends valid elevations into neighbouring no-data cells (value of the nearest
 * valid cell, 4-connected breadth-first search) up to `radius` cells; farther
 * cells become 0. This only keeps the terrain mesh and its shading continuous at
 * the national border: those cells lie outside the land mask and are never drawn.
 */
export function extendIntoNoData(
  meters: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  if (radius < 0 || radius > 254) throw new Error("radius must be within 0–254");
  const n = width * height;
  const out = new Float32Array(n);
  const distance = new Uint8Array(n).fill(255);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  for (let k = 0; k < n; k++) {
    if (!Number.isNaN(meters[k])) {
      out[k] = meters[k];
      distance[k] = 0;
      queue[tail++] = k;
    }
  }

  const visit = (from: number, to: number) => {
    if (distance[to] !== 255) return;
    distance[to] = distance[from] + 1;
    out[to] = out[from];
    queue[tail++] = to;
  };

  while (head < tail) {
    const k = queue[head++];
    if (distance[k] >= radius) continue;
    const i = k % width;
    if (i > 0) visit(k, k - 1);
    if (i < width - 1) visit(k, k + 1);
    if (k >= width) visit(k, k - width);
    if (k < n - width) visit(k, k + width);
  }
  return out;
}
