/** Largest "round" length (1, 2 or 5 × 10ⁿ) that does not exceed `maxKm`. */
export function niceLength(maxKm: number): number {
  if (!Number.isFinite(maxKm) || maxKm <= 0) return 0;
  let exponent = Math.floor(Math.log10(maxKm));
  // Guard against log10 rounding just below an exact power of ten.
  if (10 ** (exponent + 1) <= maxKm) exponent += 1;
  const base = 10 ** exponent;
  for (const step of [5, 2, 1]) {
    if (step * base <= maxKm) return step * base;
  }
  return base;
}
