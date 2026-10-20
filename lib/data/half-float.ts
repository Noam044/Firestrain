const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);

/**
 * IEEE 754 binary16 bits of a number (round half up), for half-float GPU
 * textures. Kept dependency-free so it can run inside a Web Worker.
 */
export function toHalfFloat(value: number): number {
  f32[0] = value;
  const bits = u32[0];
  const sign = (bits >>> 16) & 0x8000;
  const exponent = (bits >>> 23) & 0xff;
  let mantissa = bits & 0x7fffff;

  if (exponent === 0xff) return sign | 0x7c00 | (mantissa ? 0x200 : 0);

  let e = exponent - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    mantissa = (mantissa | 0x800000) >>> (1 - e);
    if (mantissa & 0x1000) mantissa += 0x2000;
    return sign | (mantissa >>> 13);
  }
  if (mantissa & 0x1000) {
    mantissa += 0x2000;
    if (mantissa & 0x800000) {
      mantissa = 0;
      e += 1;
      if (e >= 0x1f) return sign | 0x7c00;
    }
  }
  return sign | (e << 10) | (mantissa >>> 13);
}
