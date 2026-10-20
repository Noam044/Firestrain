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

/** NASA FIRMS detections published per calendar year (1 January → 31 December). */
export const FirmsIndexSchema = z.object({
  codec: z.literal("fs-firms-1"),
  /** Timeline day 1 = 1 January, local dates in Paris. */
  timeline: z.literal("calendar-year"),
  years: z.array(
    z.object({
      year: z.number().int(),
      file: z.string(),
      count: z.number().int().nonnegative(),
      /** Last local date covered: 31 December, or earlier for the year in progress. */
      lastDate: z.iso.date(),
      satellites: z.array(z.string()),
      products: z.array(z.string()),
    }),
  ),
});

export type FirmsIndex = z.infer<typeof FirmsIndexSchema>;

/** 750 m Lambert-93 cells where FIRMS flagged a static heat source (type = 2). */
export const FirmsStaticCellsSchema = z.object({
  cellMeters: z.number().positive(),
  /** [column, row] = floor(L93 x / cellMeters), floor(L93 y / cellMeters). */
  cells: z.array(z.tuple([z.number().int(), z.number().int()])),
});

export type FirmsStaticCells = z.infer<typeof FirmsStaticCellsSchema>;

/** Answer of /api/firms/recent: near-real-time VIIRS detections of the last 72 hours, as columns. */
export const RecentDetectionsSchema = z.object({
  /** When the server queried FIRMS (the answer is cached for about an hour). */
  generatedAt: z.iso.datetime(),
  hours: z.literal(72),
  satellites: z.array(z.string()),
  count: z.number().int().nonnegative(),
  /** Scene coordinates (km), rounded to 10 m. */
  x: z.array(z.number()),
  z: z.array(z.number()),
  /** Acquisition time, minutes since the Unix epoch (UTC). */
  t: z.array(z.number().int()),
  /** Fire radiative power, MW. */
  frp: z.array(z.number().nonnegative()),
});

export type RecentDetections = z.infer<typeof RecentDetectionsSchema>;

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

// ── Story (scripts/07-story.ts) ─────────────────────────────────────────────

/** A sourced fact, typed by hand in data/events.json; the quote is checked against the page. */
export const StoryFactSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    /** Numeric value with its unit, or `display` for a date or a phrase. */
    value: z.number().optional(),
    unit: z.string().optional(),
    display: z.string().optional(),
    note: z.string().optional(),
    approximate: z.boolean().optional(),
    atLeast: z.boolean().optional(),
    upTo: z.boolean().optional(),
    provisional: z.boolean().optional(),
    /** Date the figure refers to. */
    dataDate: z.iso.date(),
    quote: z.string().min(8),
    source: z.string(),
    url: z.url(),
    published: z.iso.date(),
  })
  .refine((f) => (f.value !== undefined && f.unit !== undefined) || f.display !== undefined, {
    message: "a fact needs value + unit, or display",
  });

export type StoryFact = z.infer<typeof StoryFactSchema>;

const StoryGroupSchema = z.discriminatedUnion("rule", [
  z.object({ rule: z.literal("department-window"), justification: z.string() }),
  z.object({
    rule: z.literal("contiguous"),
    seed: z.number().int(),
    maxGapKm: z.number().positive(),
    justification: z.string(),
  }),
]);

/** data/events.json (hand-curated source of the story). */
export const StorySourceSchema = z.object({
  note: z.string(),
  retrievedAt: z.iso.date(),
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      department: z.string(),
      from: z.iso.date(),
      to: z.iso.date(),
      group: StoryGroupSchema,
      /** Expected EFFIS ids (contiguous rule): the script recomputes and compares. */
      effisIds: z.array(z.number().int()).optional(),
      facts: z.array(StoryFactSchema),
    }),
  ),
  insurance: z.array(StoryFactSchema),
});

export type StorySource = z.infer<typeof StorySourceSchema>;

/** public/data/story/story.json: the story's figures, all derived from published data or sourced facts. */
export const StorySchema = z.object({
  year: z.number().int(),
  retrievedAt: z.iso.date(),
  /** EFFIS: last update of the year's polygons (UTC). */
  effisDataDate: z.iso.datetime(),
  headline: z.object({
    /** EFFIS official convention: fires of at least 30 ha. */
    areaHa: z.number(),
    fires: z.number().int(),
    allAreaHa: z.number(),
    seasonAreaHa: z.number(),
    previousMax: z.object({ year: z.number().int(), areaHa: z.number() }),
    /** Area (≥ 30 ha) by month of first detection, January → December. */
    monthlyAreaHa: z.array(z.number()).length(12),
  }),
  events: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      department: z.string(),
      from: z.iso.date(),
      to: z.iso.date(),
      justification: z.string(),
      effis: z.object({
        ids: z.array(z.number().int()),
        mainId: z.number().int(),
        /** Sum of the polygons, all sizes (one event, so no 30 ha threshold). */
        areaHa: z.number(),
        polygons: z.number().int(),
        firstDetection: z.iso.datetime(),
        /** [xmin, zmin, xmax, zmax] in scene km. */
        bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        /** Area-weighted land cover (%), in the order of LAND_COVER_KEYS, when EFFIS gives it. */
        landCover: z.array(z.number()).nullable(),
      }),
      facts: z.array(StoryFactSchema),
    }),
  ),
  insurance: z.array(StoryFactSchema),
  /** Paris (commune), same Lambert-93 frame as the fires, for an exact-scale comparison. */
  paris: z.object({
    rings: z.array(z.array(z.number().int())),
    areaHa: z.number(),
    /** Lambert-93 linear scale factors at Paris and at the Gironde fire: their ratio bounds the error. */
    scaleFactorParis: z.number(),
    scaleFactorGironde: z.number(),
    source: z.string(),
  }),
});

export type Story = z.infer<typeof StorySchema>;
