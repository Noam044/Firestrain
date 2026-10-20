import { test } from "node:test";
import assert from "node:assert/strict";
import { pointInRings, polygonsIntersect, segmentsIntersect } from "./polygon.ts";
import { decodePolygons, decodeRing, encodeRing } from "./rings.ts";
import { parseCsv } from "../data/csv.ts";

const square = (x: number, y: number, size: number) => [x, y, x + size, y, x + size, y + size, x, y + size];

test("pointInRings follows the even-odd rule (holes excluded)", () => {
  const outer = square(0, 0, 10);
  const hole = square(3, 3, 4);
  assert.equal(pointInRings(1, 1, [outer, hole]), true);
  assert.equal(pointInRings(5, 5, [outer, hole]), false, "inside the hole");
  assert.equal(pointInRings(11, 5, [outer, hole]), false);
});

test("segmentsIntersect handles crossing, touching and parallel segments", () => {
  assert.equal(segmentsIntersect(0, 0, 2, 2, 0, 2, 2, 0), true);
  assert.equal(segmentsIntersect(0, 0, 1, 0, 1, 0, 2, 1), true, "shared end point");
  assert.equal(segmentsIntersect(0, 0, 2, 0, 0, 1, 2, 1), false, "parallel");
  assert.equal(segmentsIntersect(0, 0, 2, 0, 1, 0, 3, 0), true, "collinear overlap");
});

test("polygonsIntersect: overlap, containment, disjoint, inside a hole", () => {
  const big = [square(0, 0, 10)];
  assert.equal(polygonsIntersect(big, [square(8, 8, 5)]), true, "overlap");
  assert.equal(polygonsIntersect(big, [square(2, 2, 1)]), true, "contained");
  assert.equal(polygonsIntersect([square(2, 2, 1)], big), true, "contains");
  assert.equal(polygonsIntersect(big, [square(20, 20, 1)]), false, "disjoint");
  const withHole = [square(0, 0, 10), square(2, 2, 6)];
  assert.equal(polygonsIntersect(withHole, [square(4, 4, 1)]), false, "inside the hole");
  // A cross: edges intersect but no vertex lies inside the other polygon.
  assert.equal(polygonsIntersect([[0, 4, 10, 4, 10, 6, 0, 6]], [[4, 0, 6, 0, 6, 10, 4, 10]]), true);
});

test("encodeRing / decodeRing round-trip at 10 m and drop the closing vertex", () => {
  const ring = [-12.346, 6.789, -12.2, 6.8, -12.1, 7.0, -12.346, 6.789];
  const deltas = encodeRing(ring);
  assert.equal(deltas.length, 6, "closing vertex dropped");
  const decoded = Array.from(decodeRing(deltas));
  const expected = [-12.35, 6.79, -12.2, 6.8, -12.1, 7.0];
  decoded.forEach((v, k) => assert.ok(Math.abs(v - expected[k]) < 1e-5, `${v} vs ${expected[k]}`));
  assert.equal(decodePolygons([[deltas], [deltas]]).length, 2);
});

test("parseCsv handles quotes, escaped quotes, separators inside quotes and a BOM", () => {
  const rows = parseCsv('﻿a;"b;c";"d ""e"""\r\n1;;3\n');
  assert.deepEqual(rows, [["a", "b;c", 'd "e"'], ["1", "", "3"]]);
});
