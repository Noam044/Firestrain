import { SCENE_SIZE } from "./frame.ts";

export type Vec3 = { x: number; y: number; z: number };

/** Ground height (scene units) at a horizontal scene position. */
export type HeightSampler = (x: number, z: number) => number;

export type ElevationGrid = {
  width: number;
  height: number;
  /** Elevation in metres, row 0 = north; NaN where there is no data. */
  meters: Float32Array;
};

/**
 * Bilinear sampler over an elevation grid covering the whole scene extent.
 * Returns heights in scene units (km × exaggeration); no data counts as 0.
 */
export function createGridSampler(grid: ElevationGrid, exaggeration: number): HeightSampler {
  const { width, height, meters } = grid;
  const scale = exaggeration / 1000;
  const at = (i: number, j: number) => {
    const v = meters[j * width + i];
    return Number.isNaN(v) ? 0 : v;
  };
  return (x, z) => {
    const u = ((x + SCENE_SIZE.width / 2) / SCENE_SIZE.width) * width - 0.5;
    const v = ((z + SCENE_SIZE.depth / 2) / SCENE_SIZE.depth) * height - 0.5;
    if (u < 0 || v < 0 || u > width - 1 || v > height - 1) return 0;
    const i = Math.min(Math.floor(u), width - 2);
    const j = Math.min(Math.floor(v), height - 2);
    const fu = u - i;
    const fv = v - j;
    const top = at(i, j) * (1 - fu) + at(i + 1, j) * fu;
    const bottom = at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu;
    return (top * (1 - fv) + bottom * fv) * scale;
  };
}

/**
 * First intersection of a ray with a height field (and the ground plane y = 0).
 * `direction` must be normalised. Marches from where the ray enters the slab
 * below `maxHeight`, then refines the crossing by bisection.
 */
export function intersectHeightfield(
  origin: Vec3,
  direction: Vec3,
  sample: HeightSampler,
  { maxHeight, step, maxDistance }: { maxHeight: number; step: number; maxDistance: number },
): Vec3 | null {
  const point = (t: number): Vec3 => ({
    x: origin.x + direction.x * t,
    y: origin.y + direction.y * t,
    z: origin.z + direction.z * t,
  });
  const below = (p: Vec3) => p.y <= Math.max(sample(p.x, p.z), 0);

  let t = 0;
  if (origin.y > maxHeight) {
    if (direction.y >= 0) return null;
    t = (origin.y - maxHeight) / -direction.y;
  }
  if (below(point(t))) return point(t);

  for (let prev = t; t <= maxDistance; prev = t) {
    t += step;
    if (below(point(t))) {
      let lo = prev;
      let hi = t;
      for (let k = 0; k < 12; k++) {
        const mid = (lo + hi) / 2;
        if (below(point(mid))) hi = mid;
        else lo = mid;
      }
      return point(hi);
    }
  }
  return null;
}
