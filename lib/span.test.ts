import { test } from "node:test";
import assert from "node:assert/strict";
import { daysBetween, monthKey, recentSpan, spanDay, spanLength, spanMonthIndex, spanMonthRange, spanStartDate, yearSpan } from "./span.ts";
import { simplifyRing } from "./geo/simplify.ts";

test("the live window is the twelve months ending with the month of the data, across a new year", () => {
  const span = recentSpan("2026-11-20T12:47:00Z");
  assert.equal(span.months.length, 12);
  assert.equal(monthKey(span.months[0]), "2025-12");
  assert.equal(monthKey(span.months[11]), "2026-11");
  assert.equal(spanStartDate(span), "2025-12-01");
  // 31 December 2025 at 23:30 UTC is already 1 January in Paris.
  const january = recentSpan("2025-12-31T23:30:00Z");
  assert.equal(monthKey(january.months[11]), "2026-01");
});

test("window days and months follow local dates in Paris", () => {
  const span = recentSpan("2026-11-20T12:00:00Z");
  assert.equal(spanDay(span, "2025-12-01T00:30:00+01:00"), 1);
  assert.equal(spanDay(span, "2026-01-01T00:30:00+01:00"), 32);
  assert.equal(spanMonthIndex(span, "2026-07-22T09:55:00Z"), 7);
  assert.equal(spanMonthIndex(span, "2025-11-30T12:00:00Z"), -1);
  assert.deepEqual(spanMonthRange(span, 0), [1, 31]);
  assert.deepEqual(spanMonthRange(span, 1), [32, 62]);
  // Dec 2025 → Nov 2026: 365 days.
  assert.equal(spanLength(span), 365);
  assert.equal(spanLength(yearSpan(2024)), 366);
  assert.equal(daysBetween("2026-11-14T10:55:00Z", "2026-11-20T12:47:00Z"), 6);
});

test("Douglas–Peucker keeps the shape and never collapses a small ring", () => {
  // A 1 km square with a 5 m bump on one side: the bump goes, the corners stay.
  const square = [[0, 0], [500, 5], [1000, 0], [1000, 1000], [0, 1000], [0, 0]];
  assert.deepEqual(simplifyRing(square, 40), [[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]]);
  // A thin sliver keeps at least a triangle (4 vertices, closed).
  const sliver = [[0, 0], [10, 1], [20, 0], [30, 1], [40, 0], [0, 0]];
  assert.ok(simplifyRing(sliver, 40).length >= 4);
});
