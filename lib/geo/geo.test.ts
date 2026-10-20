import { test } from "node:test";
import assert from "node:assert/strict";
import { L93_EXTENT, SCENE_SIZE, l93ToScene, sceneToL93 } from "./frame.ts";
import { lonLatToL93, l93ToLonLat, lonLatToScene, sceneToLonLat } from "./projection.ts";
import { niceLength } from "./scale.ts";
import { createGridSampler, intersectHeightfield } from "./heightfield.ts";

const close = (a: number, b: number, tolerance: number, label: string) =>
  assert.ok(Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b} (±${tolerance})`);

test("Lambert-93 natural origin maps to its false easting/northing", () => {
  const [x, y] = lonLatToL93([3, 46.5]);
  close(x, 700_000, 1e-6, "x");
  close(y, 6_600_000, 1e-6, "y");
});

test("WGS84 ↔ Lambert-93 round trip stays sub-millimetric across France", () => {
  const places: [number, number][] = [
    [2.3488, 48.8534], // Paris
    [-4.7703, 48.4584], // Pointe Saint-Mathieu
    [7.7521, 48.5734], // Strasbourg
    [9.1592, 41.3875], // Bonifacio
    [-1.0326, 44.8408], // Le Porge (EFFIS centroid, Gironde fire)
  ];
  for (const [lon, lat] of places) {
    const [lon2, lat2] = l93ToLonLat(lonLatToL93([lon, lat]));
    close(lon2, lon, 1e-8, `lon ${lon}`);
    close(lat2, lat, 1e-8, `lat ${lat}`);
  }
});

test("scene frame: extent corners map to ± half the scene size", () => {
  const sw = l93ToScene([L93_EXTENT.xmin, L93_EXTENT.ymin]);
  const ne = l93ToScene([L93_EXTENT.xmax, L93_EXTENT.ymax]);
  assert.deepEqual(sw, { x: -SCENE_SIZE.width / 2, z: SCENE_SIZE.depth / 2 });
  assert.deepEqual(ne, { x: SCENE_SIZE.width / 2, z: -SCENE_SIZE.depth / 2 });
  assert.deepEqual(SCENE_SIZE, { width: 1160, depth: 1090 });
});

test("scene frame: north is −Z and the transform is invertible", () => {
  const south = lonLatToScene([2.35, 43]);
  const north = lonLatToScene([2.35, 50]);
  assert.ok(north.z < south.z);
  const [lon, lat] = sceneToLonLat(lonLatToScene([5.3698, 43.2965]));
  close(lon, 5.3698, 1e-8, "lon");
  close(lat, 43.2965, 1e-8, "lat");
  assert.deepEqual(sceneToL93(l93ToScene([652_000, 6_862_000])), [652_000, 6_862_000]);
});

test("niceLength picks 1/2/5 × 10ⁿ not exceeding the budget", () => {
  assert.equal(niceLength(73), 50);
  assert.equal(niceLength(50), 50);
  assert.equal(niceLength(199), 100);
  assert.equal(niceLength(1000), 1000);
  assert.equal(niceLength(0.37), 0.2);
  assert.equal(niceLength(0), 0);
  assert.equal(niceLength(Number.NaN), 0);
});

test("height field: a vertical ray hits a flat plateau at its height", () => {
  const grid = { width: 4, height: 4, meters: new Float32Array(16).fill(2000) };
  const sample = createGridSampler(grid, 3);
  const hit = intersectHeightfield(
    { x: 0, y: 100, z: 0 },
    { x: 0, y: -1, z: 0 },
    sample,
    { maxHeight: 10, step: 0.5, maxDistance: 500 },
  );
  assert.ok(hit);
  close(hit.y, 6, 1e-3, "y (2000 m × 3 = 6 km)");
});

test("height field: no data counts as ground level and upward rays miss", () => {
  const grid = { width: 2, height: 2, meters: new Float32Array(4).fill(Number.NaN) };
  const sample = createGridSampler(grid, 4);
  const down = intersectHeightfield(
    { x: 10, y: 50, z: -10 },
    { x: 0, y: -1, z: 0 },
    sample,
    { maxHeight: 20, step: 1, maxDistance: 500 },
  );
  assert.ok(down);
  close(down.y, 0, 1e-2, "y");
  const up = intersectHeightfield(
    { x: 0, y: 50, z: 0 },
    { x: 0, y: 1, z: 0 },
    sample,
    { maxHeight: 20, step: 1, maxDistance: 500 },
  );
  assert.equal(up, null);
});
