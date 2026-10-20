import proj4 from "proj4";
import { l93ToScene, sceneToL93, type L93, type LonLat, type ScenePoint } from "./frame.ts";

/** EPSG:2154 — RGF93 v1 / Lambert-93, as published by IGN. */
export const EPSG_2154 =
  "+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 " +
  "+ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs";

const wgs84ToL93 = proj4("EPSG:4326", EPSG_2154);

export function lonLatToL93([lon, lat]: LonLat): L93 {
  const [x, y] = wgs84ToL93.forward([lon, lat]);
  return [x, y];
}

export function l93ToLonLat([x, y]: L93): LonLat {
  const [lon, lat] = wgs84ToL93.inverse([x, y]);
  return [lon, lat];
}

export function lonLatToScene(p: LonLat): ScenePoint {
  return l93ToScene(lonLatToL93(p));
}

export function sceneToLonLat(p: ScenePoint): LonLat {
  return l93ToLonLat(sceneToL93(p));
}
