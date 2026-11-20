import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { decodeFire, parisDayOfYear } from "@/lib/data/fires";
import { decodeDetections } from "@/lib/data/firms-codec";
import { EffisYearSchema, FirmsIndexSchema } from "@/lib/data/schemas";
import { bboxContains, pointInRings } from "@/lib/geo/polygon";

/** VIIRS pixel half-width, and the window around the EFFIS date: the rule of the fire card. */
const NEAR_KM = 0.4;
const BEFORE_DAYS = 2;
const AFTER_DAYS = 60;

const read = (path: string) => readFileSync(join(process.cwd(), "public", "data", path));

/**
 * Data for the Méthode page's figures, computed once when the page is built:
 * the largest fire of the latest archive year (its real outline) and the
 * VIIRS hotspots counted day by day within 400 m of that outline.
 */
export function largestFireFigure() {
  const year = EffisYearSchema.parse(JSON.parse(read("effis/fires-2026.json").toString("utf8")));
  const fire = decodeFire(year.fires.reduce((best, f) => (f.areaHa > best.areaHa ? f : best)));

  const [x0, z0, x1, z1] = fire.bbox;
  const pad = Math.max(x1 - x0, z1 - z0) * 0.08;
  const path = fire.rings
    .map((ring) => {
      const points: string[] = [];
      for (let k = 0; k < ring.length; k += 2) points.push(`${ring[k].toFixed(3)} ${ring[k + 1].toFixed(3)}`);
      return `M${points.join("L")}Z`;
    })
    .join("");

  const entry = FirmsIndexSchema.parse(JSON.parse(read("firms/index.json").toString("utf8"))).years.find((y) => y.year === 2026);
  const perDay = new Map<number, number>();
  if (entry) {
    let bytes: Uint8Array = read(entry.file);
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes);
    const detections = decodeDetections(bytes, entry.count);
    const first = parisDayOfYear(fire.firedate) - BEFORE_DAYS;
    const last = parisDayOfYear(fire.firedate) + AFTER_DAYS;
    const box: [number, number, number, number] = [x0 - NEAR_KM, z0 - NEAR_KM, x1 + NEAR_KM, z1 + NEAR_KM];
    for (let k = 0; k < detections.count; k++) {
      const x = detections.positions[2 * k];
      const z = detections.positions[2 * k + 1];
      const day = detections.day[k];
      if (day < first || day > last || !bboxContains(box, x, z)) continue;
      const near = [[0, 0], [NEAR_KM, 0], [-NEAR_KM, 0], [0, NEAR_KM], [0, -NEAR_KM]].some(([dx, dz]) =>
        pointInRings(x + dx, z + dz, fire.rings),
      );
      if (near) perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }
  }
  const days = [...perDay.entries()].sort(([a], [b]) => a - b).map(([day, count]) => ({ day, count }));
  return {
    commune: fire.commune,
    province: fire.province,
    areaHa: fire.areaHa,
    firedate: fire.firedate,
    path,
    viewBox: [x0 - pad, z0 - pad, x1 - x0 + 2 * pad, z1 - z0 + 2 * pad].join(" "),
    hotspots: { year: 2026, days, total: days.reduce((sum, d) => sum + d.count, 0) },
  };
}
