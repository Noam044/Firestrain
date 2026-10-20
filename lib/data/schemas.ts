import { z } from "zod";

/** Provenance of every file published under public/data, written by scripts/. */
export const ManifestEntrySchema = z.object({
  title: z.string().min(1),
  source: z.string().min(1),
  sourceUrl: z.url(),
  licence: z.string().min(1),
  licenceUrl: z.url(),
  /** When the raw data was downloaded (ISO 8601, UTC). */
  retrievedAt: z.iso.datetime(),
  transformations: z.array(z.string()),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

export const ManifestSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.iso.datetime(),
  files: z.record(z.string(), ManifestEntrySchema),
});

export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

const ExtentSchema = z.object({
  xmin: z.number(),
  ymin: z.number(),
  xmax: z.number(),
  ymax: z.number(),
});

export const TerrainMetaSchema = z.object({
  codec: z.literal("fs-dem-1"),
  file: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pixelSizeM: z.number().positive(),
  extentL93: ExtentSchema,
  quantization: z.object({ scale: z.number().positive(), offset: z.number() }),
  stats: z.object({
    minM: z.number(),
    maxM: z.number(),
    landPixels: z.number().int().nonnegative(),
  }),
});

export type TerrainMeta = z.infer<typeof TerrainMetaSchema>;

/** Flat [x0, z0, x1, z1, …] polylines in scene km. */
const SceneLinesSchema = z.array(
  z.array(z.number()).refine((line) => line.length >= 4 && line.length % 2 === 0, {
    message: "a polyline needs an even number of coordinates and at least two points",
  }),
);

export const BordersSchema = z.object({
  crs: z.literal("scene-km"),
  /** Boundaries shared by two departments. */
  inner: SceneLinesSchema,
  /** Outline of metropolitan France (coast and land borders). */
  outer: SceneLinesSchema,
});

export type Borders = z.infer<typeof BordersSchema>;

/** Dissolved outline of metropolitan France; rings are filled with the even-odd rule. */
export const FranceOutlineSchema = z.object({
  crs: z.literal("scene-km"),
  rings: SceneLinesSchema,
});

export type FranceOutline = z.infer<typeof FranceOutlineSchema>;

export const Departements2DSchema = z.object({
  /** SVG user units = km, origin at the north-west corner of the Lambert-93 extent. */
  crs: z.literal("l93-km-svg"),
  viewBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  features: z.array(
    z.object({
      code: z.string().regex(/^(\d{2}|2A|2B)$/),
      nom: z.string().min(1),
      d: z.string().startsWith("M"),
    }),
  ),
});

export type Departements2D = z.infer<typeof Departements2DSchema>;
