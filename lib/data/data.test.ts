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
