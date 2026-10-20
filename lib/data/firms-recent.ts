/**
 * Near-real-time FIRMS detections of the last hours, for the server route
 * /api/firms/recent. Pure functions: the network and the key stay in lib/server.
 */
import { parseCsv } from "./csv.ts";
import { SATELLITE_CODES, SATELLITES } from "./firms-codec.ts";
import type { RecentDetections } from "./schemas.ts";

export const RECENT_HOURS = 72;

export type RecentFilters = {
  /** Scene coordinates (km) inside metropolitan France. */
  inFrance: (x: number, z: number) => boolean;
  /** Lambert-93 metres near a static heat source. */
  nearStatic: (x: number, y: number) => boolean;
  lonLatToL93: (lonLat: readonly [number, number]) => readonly [number, number];
  l93ToScene: (l93: readonly [number, number]) => { x: number; z: number };
};

/** Minutes since the epoch of a FIRMS acquisition (acq_date YYYY-MM-DD, acq_time HHMM, UTC). */
export function acquisitionMinutes(acqDate: string, acqTime: string): number {
  const [y, m, d] = acqDate.split("-").map(Number);
  const hhmm = acqTime.padStart(4, "0");
  return Date.UTC(y, m - 1, d, Number(hhmm.slice(0, 2)), Number(hhmm.slice(2))) / 60_000;
}

/** Keeps detections of the last RECENT_HOURS inside France, away from static sources, deduplicated. */
export function selectRecent(csvs: readonly string[], now: Date, filters: RecentFilters): RecentDetections {
  const since = now.getTime() / 60_000 - RECENT_HOURS * 60;
  const seen = new Set<string>();
  const out: RecentDetections = {
    generatedAt: now.toISOString(),
    hours: RECENT_HOURS,
    satellites: [],
    count: 0,
    x: [],
    z: [],
    t: [],
    frp: [],
  };
  const satellites = new Set<number>();
  for (const csv of csvs) {
    const [header, ...rows] = parseCsv(csv, ",");
    if (!header?.includes("latitude") || !header.includes("acq_date")) throw new Error("unexpected FIRMS answer");
    const col = (name: string) => header.indexOf(name);
    const [lat, lon, date, time, sat, frp] = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "frp"].map(col);
    for (const row of rows) {
      if (row.length !== header.length) continue;
      const t = acquisitionMinutes(row[date], row[time]);
      if (t < since || t > now.getTime() / 60_000) continue;
      const key = `${row[sat]}|${row[date]}|${row[time]}|${row[lat]}|${row[lon]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const l93 = filters.lonLatToL93([Number(row[lon]), Number(row[lat])]);
      if (filters.nearStatic(l93[0], l93[1])) continue;
      const scene = filters.l93ToScene(l93);
      if (!filters.inFrance(scene.x, scene.z)) continue;
      const satellite = SATELLITE_CODES[row[sat]];
      if (satellite !== undefined) satellites.add(satellite);
      out.x.push(Math.round(scene.x * 100) / 100);
      out.z.push(Math.round(scene.z * 100) / 100);
      out.t.push(t);
      out.frp.push(Math.max(0, Math.round(Number(row[frp]) * 10) / 10) || 0);
    }
  }
  out.count = out.t.length;
  out.satellites = [...satellites].sort().map((s) => SATELLITES[s]);
  return out;
}

/** Static-source test over [column, row] cells of `cellMeters` (the cell and its 8 neighbours). */
export function staticCellTest(cells: readonly (readonly [number, number])[], cellMeters: number) {
  const set = new Set(cells.map(([i, j]) => `${i}:${j}`));
  return (x: number, y: number) => {
    const i = Math.floor(x / cellMeters);
    const j = Math.floor(y / cellMeters);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) if (set.has(`${i + di}:${j + dj}`)) return true;
    return false;
  };
}

/**
 * Columns for the hotspot layers: `day` is minus the age in days at generatedAt
 * (so "today" = 0 and a detection fades out after 3 days), `frp` in 0.1 MW.
 */
export function recentToColumns(recent: RecentDetections | undefined) {
  if (!recent) return null;
  const now = Date.parse(recent.generatedAt) / 60_000;
  const positions = new Float32Array(2 * recent.count);
  const day = new Float32Array(recent.count);
  const frp = new Float32Array(recent.count);
  for (let k = 0; k < recent.count; k++) {
    positions[2 * k] = recent.x[k];
    positions[2 * k + 1] = recent.z[k];
    day[k] = -(now - recent.t[k]) / 1440;
    frp[k] = recent.frp[k] * 10;
  }
  return { count: recent.count, positions, day, frp };
}
