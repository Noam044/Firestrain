export type MipLevel = { width: number; height: number; channels: Float32Array[] };

/**
 * Box-filtered mip pyramid (level 0 first, down to 1 × 1), following the WebGL
 * rule size(n + 1) = max(1, floor(size(n) / 2)). Each output cell averages the
 * 2 × 2 block below it, clamped at odd edges.
 */
export function mipPyramid(channels: Float32Array[], width: number, height: number): MipLevel[] {
  const levels: MipLevel[] = [{ width, height, channels }];
  let current = levels[0];
  while (current.width > 1 || current.height > 1) {
    const w = Math.max(1, Math.floor(current.width / 2));
    const h = Math.max(1, Math.floor(current.height / 2));
    const { width: pw, height: ph } = current;
    const next = current.channels.map((source) => {
      const out = new Float32Array(w * h);
      for (let j = 0; j < h; j++) {
        const j0 = Math.min(2 * j, ph - 1);
        const j1 = Math.min(2 * j + 1, ph - 1);
        for (let i = 0; i < w; i++) {
          const i0 = Math.min(2 * i, pw - 1);
          const i1 = Math.min(2 * i + 1, pw - 1);
          out[j * w + i] =
            (source[j0 * pw + i0] + source[j0 * pw + i1] + source[j1 * pw + i0] + source[j1 * pw + i1]) / 4;
        }
      }
      return out;
    });
    current = { width: w, height: h, channels: next };
    levels.push(current);
  }
  return levels;
}
