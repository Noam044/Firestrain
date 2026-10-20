/**
 * FireStrain detections codec "fs-firms-1": NASA FIRMS hotspots as columns
 * (structure of arrays), shared by scripts/03-firms.ts and the browser.
 *
 * Layout for n detections (all little-endian, every column naturally aligned):
 *   Float32 × 2n  scene x, z (km)
 *   Uint16  × n   timeline day (1 = 1 January, local date in Paris)
 *   Uint16  × n   fire radiative power, in 0.1 MW
 *   Uint8   × n   confidence (0 low, 1 nominal, 2 high)
 *   Uint8   × n   satellite (index in SATELLITES)
 *   Uint8   × n   1 for a night-time pass
 */

export const FIRMS_CODEC = "fs-firms-1";
export const SATELLITES = ["S-NPP", "NOAA-20", "NOAA-21"] as const;
/** FIRMS CSV `satellite` values → index in SATELLITES. */
export const SATELLITE_CODES: Readonly<Record<string, number>> = {
  N: 0,
  "Suomi NPP": 0,
  N20: 1,
  "NOAA-20": 1,
  N21: 2,
  "NOAA-21": 2,
};
export const CONFIDENCE_LABELS = ["faible", "nominale", "élevée"] as const;

export type Detections = {
  count: number;
  positions: Float32Array;
  day: Uint16Array;
  /** Fire radiative power in 0.1 MW. */
  frp: Uint16Array;
  confidence: Uint8Array;
  satellite: Uint8Array;
  night: Uint8Array;
};

export const BYTES_PER_DETECTION = 15;

export function encodeDetections(d: Detections): Uint8Array {
  const n = d.count;
  const out = new Uint8Array(n * BYTES_PER_DETECTION);
  const buffer = out.buffer;
  new Float32Array(buffer, 0, 2 * n).set(d.positions);
  new Uint16Array(buffer, 8 * n, n).set(d.day);
  new Uint16Array(buffer, 10 * n, n).set(d.frp);
  out.set(d.confidence, 12 * n);
  out.set(d.satellite, 13 * n);
  out.set(d.night, 14 * n);
  return out;
}

export function decodeDetections(bytes: Uint8Array, count: number): Detections {
  if (bytes.length !== count * BYTES_PER_DETECTION) {
    throw new Error(`expected ${count * BYTES_PER_DETECTION} bytes, got ${bytes.length}`);
  }
  // Typed-array views need an aligned offset: copy when the bytes do not start on one.
  const aligned = bytes.byteOffset % 4 === 0 ? bytes : bytes.slice();
  const { buffer, byteOffset: o } = aligned;
  const n = count;
  return {
    count: n,
    positions: new Float32Array(buffer, o, 2 * n),
    day: new Uint16Array(buffer, o + 8 * n, n),
    frp: new Uint16Array(buffer, o + 10 * n, n),
    confidence: new Uint8Array(buffer, o + 12 * n, n),
    satellite: new Uint8Array(buffer, o + 13 * n, n),
    night: new Uint8Array(buffer, o + 14 * n, n),
  };
}
