/** Minimal GeoJSON (RFC 7946) types used by the data pipeline. */

export type Position = number[];

export type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "MultiPoint"; coordinates: Position[] }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "MultiLineString"; coordinates: Position[][] }
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

export type Feature<G extends Geometry = Geometry, P = Record<string, unknown>> = {
  type: "Feature";
  geometry: G;
  properties: P;
};

export type FeatureCollection<G extends Geometry = Geometry, P = Record<string, unknown>> = {
  type: "FeatureCollection";
  features: Feature<G, P>[];
};
