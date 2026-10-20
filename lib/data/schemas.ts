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

/** EFFIS land-cover shares (%), in the order of the EFFIS API fields. */
export const LAND_COVER_KEYS = [
  "broadlea",
  "conifer",
  "mixed",
  "scleroph",
  "transit",
  "othernatlc",
  "agriareas",
  "artifsurf",
  "otherlc",
] as const;
export type LandCoverKey = (typeof LAND_COVER_KEYS)[number];

const Percent = z.number().min(0).max(100);
/** Shares in the order of LAND_COVER_KEYS (compact: repeated key names weigh a lot). */
const LandCoverSchema = z.array(Percent).length(LAND_COVER_KEYS.length);

/** One EFFIS burnt-area polygon, as published for the browser. */
export const EffisFireSchema = z.object({
  id: z.number().int().positive(),
  /** First satellite detection (UTC). Not the SDIS alert time. */
  firedate: z.iso.datetime(),
  /** Last update of the polygon by EFFIS (UTC): the date of the data. */
  lastUpdate: z.iso.datetime(),
  /** Area published by EFFIS, not recomputed from the simplified outline. */
  areaHa: z.number().nonnegative(),
  province: z.string(),
  /** Commune named by EFFIS — not necessarily where the fire started. */
  commune: z.string(),
  landCover: LandCoverSchema.nullable(),
  natura2000Pct: Percent.nullable(),
  /** [xmin, zmin, xmax, zmax] in scene km. */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** Polygons → rings → delta-encoded 10 m integers (lib/geo/rings.ts). */
  polygons: z.array(z.array(z.array(z.number().int()))),
});

export type EffisFire = z.infer<typeof EffisFireSchema>;

export const EffisYearSchema = z.object({
  year: z.number().int(),
  encoding: z.literal("scene-10m-delta"),
  fires: z.array(EffisFireSchema),
});

export type EffisYear = z.infer<typeof EffisYearSchema>;

export const EffisIndexSchema = z.object({
  /** EFFIS official statistics count fires of at least this size. */
  thresholdHa: z.literal(30),
  years: z.array(
    z.object({
      year: z.number().int(),
      file: z.string(),
      fires: z.number().int().nonnegative(),
      firesAtLeast30: z.number().int().nonnegative(),
      areaHa: z.number().nonnegative(),
      areaHaAtLeast30: z.number().nonnegative(),
      lastUpdate: z.iso.datetime(),
    }),
  ),
});

export type EffisIndex = z.infer<typeof EffisIndexSchema>;

const NullableNumber = z.number().nullable();

export const EffisStatsSchema = z.object({
  /** EFFIS statistics portal, country totals (fires ≥ 30 ha). */
  annual: z.array(
    z.object({ year: z.number().int(), areaHa: z.number(), fires: z.number().int() }),
  ),
  /** Weekly series of one year with the min / mean / max of previous years. */
  weekly: z.object({
    year: z.number().int(),
    referenceFrom: z.number().int(),
    weeks: z.array(
      z.object({
        week: z.number().int(),
        date: z.iso.date(),
        areaHa: NullableNumber,
        cumulativeHa: NullableNumber,
        cumulativeMinHa: z.number(),
        cumulativeMeanHa: z.number(),
        cumulativeMaxHa: z.number(),
      }),
    ),
  }),
});

export type EffisStats = z.infer<typeof EffisStatsSchema>;

const AreaHa = z.number().nonnegative();

/** BDIFF yearly totals, national and per department (fires of type F, metropolitan France). */
export const BdiffAnnualSchema = z.object({
  fireType: z.literal("F"),
  /** Last campaign published (public diffusion stops at the previous year). */
  availableUpTo: z.number().int(),
  years: z.array(
    z.object({
      year: z.number().int(),
      fires: z.number().int().nonnegative(),
      areaHa: AreaHa,
      departements: z.record(z.string(), z.object({ fires: z.number().int(), areaHa: AreaHa })),
    }),
  ),
});

export type BdiffAnnual = z.infer<typeof BdiffAnnualSchema>;

/** Per commune (INSEE code at the time of the fire): [year, fires, ha] triples. */
export const BdiffCommunesSchema = z.record(z.string(), z.array(z.tuple([z.number().int(), z.number().int(), AreaHa])));

export const BdiffRecordSchema = z.object({
  year: z.number().int(),
  numero: z.string(),
  departement: z.string(),
  insee: z.string(),
  commune: z.string(),
  /** First alert received by the CODIS, local time as published ("YYYY-MM-DD HH:MM"). */
  alert: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/),
  areaHa: AreaHa.nullable(),
  forestHa: AreaHa.nullable(),
  surfacePrecision: z.string(),
  cause: z.string(),
  dataQuality: z.string(),
  deaths: z.number().int().nullable(),
  buildingsDestroyed: z.number().int().nullable(),
  buildingsDamaged: z.number().int().nullable(),
});

export type BdiffRecord = z.infer<typeof BdiffRecordSchema>;

/** Automatic EFFIS ↔ BDIFF links, kept only when exactly one candidate exists. */
export const BdiffMatchesSchema = z.object({
  rule: z.object({
    description: z.string(),
    windowDaysBefore: z.number(),
    windowDaysAfter: z.number(),
    minAreaHa: z.number(),
    minAreaRatio: z.number(),
    maxAreaRatio: z.number(),
  }),
  years: z.array(
    z.object({
      year: z.number().int(),
      polygons: z.number().int(),
      matched: z.number().int(),
      ambiguous: z.number().int(),
      noCandidate: z.number().int(),
    }),
  ),
  matches: z.record(
    z.string(),
    BdiffRecordSchema.extend({
      /** Other EFFIS polygons linked to the same BDIFF record (one fire, several polygons). */
      sharedWith: z.array(z.number().int()),
    }),
  ),
});

export type BdiffMatches = z.infer<typeof BdiffMatchesSchema>;

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
