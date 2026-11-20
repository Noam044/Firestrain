/**
 * EFFIS burnt-area records (REST API rest/2/burntareas/current) → EffisFire.
 * Shared by the data script (whole archive, 02-effis) and the live server
 * route (last twelve months), so both publish the same fields the same way.
 */
import { z } from "zod";
import { l93ToScene } from "../geo/frame.ts";
import { ringsBBox } from "../geo/polygon.ts";
import { encodeRing } from "../geo/rings.ts";
import type { Position } from "../geo/geojson.ts";
import { LAND_COVER_KEYS, type EffisFire } from "./schemas.ts";

export const EFFIS_API = "https://api.effis.emergency.copernicus.eu/rest/2/burntareas/current/";
export const EFFIS_SOURCE = "EFFIS — European Forest Fire Information System (Copernicus, Commission européenne / JRC)";
export const EFFIS_LICENCE = {
  licence: "CC BY 4.0",
  licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const;

/** Metropolitan France incl. Corsica (excludes the overseas polygons labelled FR). */
const METRO = { lonMin: -5.5, lonMax: 10, latMin: 41, latMax: 51.5 };

const NumberLike = z.union([z.number(), z.string()]).nullable();
export const RawRecordSchema = z.object({
  id: z.number().int(),
  centroid: z.object({ type: z.literal("Point"), coordinates: z.array(z.number()).min(2) }),
  shape: z.object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.array(z.unknown()),
  }),
  country: z.string(),
  province: z.string().nullable(),
  commune: z.string().nullable(),
  firedate: z.string(),
  lastupdate: z.string(),
  area_ha: z.number(),
  percna2k: NumberLike,
  ...Object.fromEntries(LAND_COVER_KEYS.map((key) => [key, NumberLike])),
});
export type RawRecord = z.infer<typeof RawRecordSchema> & Record<string, unknown>;
export const RawPageSchema = z.object({
  count: z.number().int(),
  next: z.string().nullable().optional(),
  results: z.array(RawRecordSchema),
});

const toNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);
const round1 = (value: number) => Math.round(value * 10) / 10;

export function isMetropolitan(record: RawRecord): boolean {
  const [lon, lat] = record.centroid.coordinates;
  return lon >= METRO.lonMin && lon <= METRO.lonMax && lat >= METRO.latMin && lat <= METRO.latMax;
}

/** The record's shape as polygons → rings → [lon, lat] positions. */
export function recordPolygons(record: RawRecord): Position[][][] {
  const { type, coordinates } = record.shape;
  return (type === "Polygon" ? [coordinates] : coordinates) as Position[][][];
}

/** Lambert-93 polygons → delta-encoded scene rings and their scene bbox (rings under 3 vertices dropped). */
export function encodeL93Polygons(polygons: readonly (readonly Position[])[][]): Pick<EffisFire, "polygons" | "bbox"> {
  const sceneRings: number[][] = [];
  const encoded = polygons
    .map((rings) =>
      rings
        .map((ring) => {
          const flat = ring.flatMap(([x, y]) => {
            const p = l93ToScene([x, y]);
            return [p.x, p.z];
          });
          sceneRings.push(flat);
          return encodeRing(flat);
        })
        .filter((ring) => ring.length >= 6),
    )
    .filter((rings) => rings.length > 0);
  const box = ringsBBox(sceneRings).map((v) => Math.round(v * 100) / 100);
  return { polygons: encoded, bbox: [box[0], box[1], box[2], box[3]] };
}

/** Published fields of a record, around its already encoded outline. */
export function effisFire(record: RawRecord, outline: Pick<EffisFire, "polygons" | "bbox">): EffisFire {
  const cover = LAND_COVER_KEYS.map((key) => toNumber(record[key]));
  const natura = toNumber(record.percna2k);
  return {
    id: record.id,
    firedate: new Date(record.firedate).toISOString(),
    lastUpdate: new Date(record.lastupdate).toISOString(),
    areaHa: record.area_ha,
    province: record.province ?? "",
    commune: record.commune ?? "",
    landCover: cover.some((v) => v === null) ? null : cover.map((v) => round1(v as number)),
    natura2000Pct: natura === null ? null : round1(natura),
    ...outline,
  };
}
