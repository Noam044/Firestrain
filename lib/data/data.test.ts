import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  codeToMeters,
  decodeCodes,
  encodeCodes,
  metersToCode,
} from "./heightmap-codec.ts";
import { toHalfFloat } from "./half-float.ts";
import { extendIntoNoData } from "./fill.ts";
import { mipPyramid } from "./mipmaps.ts";
import { decodeFire, findFireAt, parisDayOfYear } from "./fires.ts";
import { encodeRing } from "../geo/rings.ts";
import type { EffisFire } from "./schemas.ts";

const squareFire = (id: number, x: number, z: number, size: number, areaHa: number): EffisFire => ({
  id,
  firedate: "2026-07-22T09:55:00.000Z",
  lastUpdate: "2026-07-23T05:45:17.536Z",
  areaHa,
  province: "Gironde",
  commune: "Porge",
  landCover: null,
  natura2000Pct: null,
  bbox: [x, z, x + size, z + size],
  polygons: [[encodeRing([x, z, x + size, z, x + size, z + size, x, z + size])]],
});

test("findFireAt returns the smallest fire containing the point, or null", () => {
  const fires = [squareFire(1, 0, 0, 10, 10_000), squareFire(2, 2, 2, 2, 400)].map(decodeFire);
  assert.equal(findFireAt(fires, 3, 3)?.id, 2);
  assert.equal(findFireAt(fires, 8, 8)?.id, 1);
  assert.equal(findFireAt(fires, 11, 1), null);
});

test("parisDayOfYear counts days in Europe/Paris, across midnight UTC", () => {
  assert.equal(parisDayOfYear("2026-01-01T00:30:00Z"), 1);
  assert.equal(parisDayOfYear("2026-06-01T12:00:00Z"), 152);
  // 22:30 UTC on 30 June is already 1 July in Paris (UTC+2).
  assert.equal(parisDayOfYear("2026-06-30T22:30:00Z"), 182);
});

test("mipPyramid halves down to 1 × 1 and averages 2 × 2 blocks", () => {
  const level0 = new Float32Array([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29]);
  const levels = mipPyramid([level0], 5, 3);
  assert.deepEqual(
    levels.map((l) => [l.width, l.height]),
    [[5, 3], [2, 1], [1, 1]],
  );
  assert.deepEqual(Array.from(levels[1].channels[0]), [7, 11]);
  assert.deepEqual(Array.from(levels[2].channels[0]), [9]);
});

test("extendIntoNoData copies the nearest valid value within the radius only", () => {
  const N = Number.NaN;
  // 5 × 3 grid, a single valid cell in the middle of the left column.
  const meters = new Float32Array([N, N, N, N, N, 100, N, N, N, N, N, N, N, N, N]);
  const filled = extendIntoNoData(meters, 5, 3, 2);
  assert.deepEqual(
    Array.from(filled),
    [100, 100, 0, 0, 0, 100, 100, 100, 0, 0, 100, 100, 0, 0, 0],
  );
  assert.ok(Number.isNaN(meters[0]), "input left untouched");
});

test("metersToCode / codeToMeters keep 0.1 m precision and reserve 0 for no data", () => {
  assert.equal(metersToCode(0), 1000);
  assert.equal(metersToCode(4808.7), 49087);
  assert.equal(metersToCode(Number.NaN), 0);
  assert.equal(metersToCode(-500), 1, "clamped above the no-data code");
  assert.ok(Number.isNaN(codeToMeters(0)));
  assert.ok(Math.abs(codeToMeters(metersToCode(123.46)) - 123.5) < 1e-9);
  for (const m of [-12.34, 0.04, 151.27, 4807.96])
    assert.ok(Math.abs(codeToMeters(metersToCode(m)) - m) <= 0.05 + 1e-9, `${m} m`);
});

test("fs-dem-1 round-trips arbitrary codes, including no data and extremes", () => {
  const width = 37;
  const height = 23;
  const codes = new Uint16Array(width * height);
  let seed = 7;
  for (let k = 0; k < codes.length; k++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    codes[k] = k % 11 === 0 ? 0 : seed % 2 ? 0xffff : seed & 0xffff;
  }
  const decoded = decodeCodes(encodeCodes(codes, width, height), width, height);
  assert.deepEqual(decoded, codes);
});

test("fs-dem-1 turns smooth relief into mostly-zero residuals", () => {
  const width = 64;
  const height = 64;
  const codes = new Uint16Array(width * height);
  for (let j = 0; j < height; j++)
    for (let i = 0; i < width; i++) codes[j * width + i] = 1000 + 3 * i + 5 * j;
  const planes = encodeCodes(codes, width, height);
  const raw = gzipSync(Buffer.from(codes.buffer)).length;
  const coded = gzipSync(planes).length;
  assert.ok(coded < raw / 4, `coded ${coded} B should be far below raw ${raw} B`);
  assert.deepEqual(decodeCodes(new Uint8Array(gunzipSync(gzipSync(planes))), width, height), codes);
});

test("toHalfFloat matches reference binary16 encodings", () => {
  assert.equal(toHalfFloat(0), 0x0000);
  assert.equal(toHalfFloat(1), 0x3c00);
  assert.equal(toHalfFloat(-2), 0xc000);
  assert.equal(toHalfFloat(0.5), 0x3800);
  assert.equal(toHalfFloat(65504), 0x7bff);
  assert.equal(toHalfFloat(1e6), 0x7c00);
  assert.equal(toHalfFloat(4807), 0x6cb2);
});
