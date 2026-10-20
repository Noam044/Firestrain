export type ColorToken =
  | "--ash-950"
  | "--ash-900"
  | "--ash-800"
  | "--ash-700"
  | "--ash-600"
  | "--ash-400"
  | "--bone-300"
  | "--bone-100"
  | "--char"
  | "--ember"
  | "--sea";

/**
 * Reads a colour token defined on :root (app/globals.css) as raw sRGB
 * components in 0–1, so the shaders paint exactly the CSS colours
 * (the canvas renders with `linear` and `flat`, i.e. no conversion).
 */
export function readColorToken(name: ColorToken): [number, number, number] {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) throw new Error(`le token ${name} doit être une couleur #rrggbb (reçu « ${value} »)`);
  const n = Number.parseInt(match[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
