/**
 * The single scene coordinate system of FireStrain.
 *
 * Lambert-93 (EPSG:2154) metres are mapped to scene units of 1 km, with the
 * origin at the centre of the metropolitan extent below.
 * Scene axes: +X = east, +Z = south (north is −Z), +Y = up.
 */

export const L93_EXTENT = {
  xmin: 90_000,
  ymin: 6_030_000,
  xmax: 1_250_000,
  ymax: 7_120_000,
} as const;

export const METERS_PER_UNIT = 1000;

export const L93_ORIGIN = {
  x: (L93_EXTENT.xmin + L93_EXTENT.xmax) / 2,
  y: (L93_EXTENT.ymin + L93_EXTENT.ymax) / 2,
} as const;

/** Size of the extent in scene units (km). */
export const SCENE_SIZE = {
  width: (L93_EXTENT.xmax - L93_EXTENT.xmin) / METERS_PER_UNIT,
  depth: (L93_EXTENT.ymax - L93_EXTENT.ymin) / METERS_PER_UNIT,
} as const;

/** Lambert-93 coordinates in metres: [easting, northing]. */
export type L93 = readonly [x: number, y: number];
/** WGS84 coordinates in degrees: [longitude, latitude]. */
export type LonLat = readonly [lon: number, lat: number];
/** Horizontal position in the scene, in km. */
export type ScenePoint = { readonly x: number; readonly z: number };

export function l93ToScene([x, y]: L93): ScenePoint {
  return {
    x: (x - L93_ORIGIN.x) / METERS_PER_UNIT,
    z: (L93_ORIGIN.y - y) / METERS_PER_UNIT,
  };
}

export function sceneToL93({ x, z }: ScenePoint): L93 {
  return [L93_ORIGIN.x + x * METERS_PER_UNIT, L93_ORIGIN.y - z * METERS_PER_UNIT];
}
