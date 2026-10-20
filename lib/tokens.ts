export type ColorToken =
  | "--ink"
  | "--moss"
  | "--scorch"
  | "--scorch-ink"
  | "--cendre"
  | "--amber"
  | "--sea"
  | "--relief-light"
  | "--relief-flat"
  | "--relief-shadow"
  | "--relief-high"
  | "--water"
  | "--coast"
  | "--boundary";

/**
 * Reads a colour token defined on :root (app/globals.css) as raw sRGB
 * components in 0–1, so the shaders paint exactly the CSS colours
 * (the canvas renders with `linear` and `flat`, i.e. no conversion).
 */
export function readColorToken(name: ColorToken): [number, number, number] {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // The CSS minifier may shorten #ffffff to #fff.
  const match = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(value);
  if (!match) throw new Error(`le token ${name} doit être une couleur #rrggbb (reçu « ${value} »)`);
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
  const n = Number.parseInt(hex, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
