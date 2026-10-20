/**
 * FireStrain heightmap codec "fs-dem-1" (lossless, shared by the pipeline and the browser).
 *
 * Elevations are quantised to Uint16 codes (0 = no data) on a row-major grid,
 * row 0 = north. Encoding: planar prediction (left + up − upper-left), zigzag
 * residuals, then byte planes (all low bytes, then all high bytes), which
 * compress far better with gzip than raw 16-bit samples. Gzip itself is applied
 * outside this module (node:zlib in scripts, DecompressionStream in the browser).
 */

export const DEM_CODEC = "fs-dem-1";

export type Quantization = {
  /** Metres per code step. */
  scale: number;
  /** Elevation (m) represented by code 0 — never used for data, 0 means "no data". */
  offset: number;
};

export const DEM_QUANTIZATION: Quantization = { scale: 0.1, offset: -100 };

export function metersToCode(meters: number, q: Quantization = DEM_QUANTIZATION): number {
  if (!Number.isFinite(meters)) return 0;
  const code = Math.round((meters - q.offset) / q.scale);
  return Math.min(Math.max(code, 1), 0xffff);
}

export function codeToMeters(code: number, q: Quantization = DEM_QUANTIZATION): number {
  return code === 0 ? Number.NaN : q.offset + code * q.scale;
}

function predict(codes: Uint16Array, width: number, index: number): number {
  const i = index % width;
  const j = (index - i) / width;
  if (j === 0) return i === 0 ? 0 : codes[index - 1];
  if (i === 0) return codes[index - width];
  return codes[index - 1] + codes[index - width] - codes[index - width - 1];
}

export function encodeCodes(codes: Uint16Array, width: number, height: number): Uint8Array {
  const n = width * height;
  if (codes.length !== n) throw new Error(`expected ${n} codes, got ${codes.length}`);
  const planes = new Uint8Array(n * 2);
  for (let k = 0; k < n; k++) {
    const residual = (codes[k] - predict(codes, width, k)) & 0xffff;
    const signed = residual >= 0x8000 ? residual - 0x10000 : residual;
    const zigzag = signed >= 0 ? signed * 2 : -signed * 2 - 1;
    planes[k] = zigzag & 0xff;
    planes[n + k] = zigzag >>> 8;
  }
  return planes;
}

export function decodeCodes(planes: Uint8Array, width: number, height: number): Uint16Array {
  const n = width * height;
  if (planes.length !== n * 2) throw new Error(`expected ${n * 2} bytes, got ${planes.length}`);
  const codes = new Uint16Array(n);
  for (let k = 0; k < n; k++) {
    const zigzag = planes[k] | (planes[n + k] << 8);
    const signed = zigzag & 1 ? -((zigzag + 1) >>> 1) : zigzag >>> 1;
    codes[k] = (predict(codes, width, k) + signed) & 0xffff;
  }
  return codes;
}
