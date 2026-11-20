import { useQueries, useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { z } from "zod";
import { decodeFire, type DecodedFire } from "./fires.ts";
import { decodeDetections, type Detections } from "./firms-codec.ts";
import {
  BdiffAnnualSchema,
  BdiffMatchesSchema,
  BordersSchema,
  Departements2DSchema,
  EffisIndexSchema,
  EffisYearSchema,
  FirmsIndexSchema,
  FranceOutlineSchema,
  ManifestSchema,
  NeighboursSchema,
  RecentDetectionsSchema,
  RecentFiresSchema,
  TerrainMetaSchema,
  type TerrainMeta,
} from "./schemas.ts";
import type { GpuLevel, TerrainWorkerRequest, TerrainWorkerResponse } from "./terrain.worker.ts";

/** Static files never change during a visit. */
// "static": never stale, and no clock read (Date.now() is not allowed while prerendering).
const staticData = { staleTime: "static" as const, gcTime: Number.POSITIVE_INFINITY, retry: 1 };

async function fetchData(path: string): Promise<Response> {
  const response = await fetch(`/data/${path}`);
  if (!response.ok) throw new Error(`${path} : HTTP ${response.status}`);
  return response;
}

async function fetchJson<S extends z.ZodType>(path: string, schema: S): Promise<z.output<S>> {
  return schema.parse(await (await fetchData(path)).json());
}

export const useBorders = () =>
  useQuery({
    queryKey: ["data", "borders"],
    queryFn: () => fetchJson("admin/departements-lignes.json", BordersSchema),
    ...staticData,
  });

export const useFranceOutline = () =>
  useQuery({
    queryKey: ["data", "france-outline"],
    queryFn: () => fetchJson("admin/france-contour.json", FranceOutlineSchema),
    ...staticData,
  });

export const useDepartements2D = () =>
  useQuery({
    queryKey: ["data", "departements-2d"],
    queryFn: () => fetchJson("admin/departements-2d.json", Departements2DSchema),
    ...staticData,
  });

/** Provenance of every published file (source, licence, retrieval date). */
export const useManifest = () =>
  useQuery({
    queryKey: ["data", "manifest"],
    queryFn: () => fetchJson("manifest.json", ManifestSchema),
    ...staticData,
  });

/** Countries around France, drawn flat for context. */
export const useNeighbours = () =>
  useQuery({
    queryKey: ["data", "neighbours"],
    queryFn: () => fetchJson("admin/voisins.json", NeighboursSchema),
    ...staticData,
  });

export const useEffisIndex = () =>
  useQuery({
    queryKey: ["data", "effis-index"],
    queryFn: () => fetchJson("effis/index.json", EffisIndexSchema),
    ...staticData,
  });

export type FireYear = { year: number; fires: DecodedFire[] };

const effisYearQuery = (year: number, enabled: boolean) => ({
  queryKey: ["data", "effis", year],
  queryFn: async (): Promise<FireYear> => {
    const data = await fetchJson(`effis/fires-${year}.json`, EffisYearSchema);
    return { year: data.year, fires: data.fires.map(decodeFire) };
  },
  enabled,
  ...staticData,
});

export const useEffisYear = (year: number, enabled = true) => useQuery(effisYearQuery(year, enabled));

/** Stable combine (module scope): the result keeps its identity while the queries do. */
function combineYears(results: UseQueryResult<FireYear>[]) {
  return {
    data: results.every((r) => r.data) ? results.map((r) => (r.data as FireYear).fires) : undefined,
    error: results.find((r) => r.error)?.error ?? null,
  };
}

export const useEffisYears = (years: readonly number[], enabled: boolean) =>
  useQueries({ queries: years.map((year) => effisYearQuery(year, enabled)), combine: combineYears });

export const useFirmsIndex = () =>
  useQuery({
    queryKey: ["data", "firms-index"],
    queryFn: () => fetchJson("firms/index.json", FirmsIndexSchema),
    ...staticData,
  });

/** Gzipped payloads may already be inflated by the host (Content-Encoding): check the magic bytes. */
async function gunzipIfNeeded(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** FIRMS detections of one year (June → September), or null when the year has none. */
export function useDetections(year: number, enabled = true) {
  const index = useFirmsIndex();
  const entry = index.data?.years.find((y) => y.year === year) ?? null;
  return useQuery({
    queryKey: ["data", "firms", year],
    queryFn: async (): Promise<Detections | null> => {
      if (!entry) return null;
      const bytes = await gunzipIfNeeded(new Uint8Array(await (await fetchData(entry.file)).arrayBuffer()));
      return decodeDetections(bytes, entry.count);
    },
    enabled: enabled && index.isSuccess,
    ...staticData,
  });
}

/** Last 72 hours of FIRMS detections, from the server route (the key stays on the server). */
export const useRecentDetections = (enabled: boolean) =>
  useQuery({
    queryKey: ["firms", "recent"],
    queryFn: async () => {
      const response = await fetch("/api/firms/recent");
      if (!response.ok) throw new Error(`firms/recent : HTTP ${response.status}`);
      return RecentDetectionsSchema.parse(await response.json());
    },
    enabled,
    staleTime: 15 * 60_000,
    retry: 1,
  });

export type RecentFireData = { generatedAt: string; fires: DecodedFire[] };

/** Burnt areas of the last twelve months, from the server route (EFFIS queried about hourly). */
export const useRecentFires = (enabled: boolean) =>
  useQuery({
    queryKey: ["effis", "recent"],
    queryFn: async (): Promise<RecentFireData> => {
      const response = await fetch("/api/effis/recent");
      if (!response.ok) throw new Error(`effis/recent : HTTP ${response.status}`);
      // A gzip file (see the route), or plain JSON if something on the way already inflated it.
      const bytes = await gunzipIfNeeded(new Uint8Array(await response.arrayBuffer()));
      const data = RecentFiresSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
      return { generatedAt: data.generatedAt, fires: data.fires.map(decodeFire) };
    },
    enabled,
    staleTime: 15 * 60_000,
    retry: 1,
  });

export const useBdiffAnnual = () =>
  useQuery({
    queryKey: ["data", "bdiff-annual"],
    queryFn: () => fetchJson("bdiff/annuel.json", BdiffAnnualSchema),
    ...staticData,
  });

export const useBdiffMatches = () =>
  useQuery({
    queryKey: ["data", "bdiff-matches"],
    queryFn: () => fetchJson("bdiff/rapprochements.json", BdiffMatchesSchema),
    ...staticData,
  });

export type TerrainData = {
  meta: TerrainMeta;
  /** Elevation in metres, NaN where the BD ALTI has no value (row 0 = north). */
  meters: Float32Array;
  /**
   * Mip pyramid for the GPU, level 0 first: interleaved binary16 pairs
   * [height extended past the border, has-altitude flag].
   */
  levels: GpuLevel[];
};

export type DemResolution = 500 | 1000;

/** Cells of no data filled from their neighbours so the mesh stays continuous at borders. */
const BORDER_FILL_CELLS = 6;

async function loadTerrain(resolution: DemResolution): Promise<TerrainData> {
  const meta = await fetchJson(`terrain/dem-${resolution}m.json`, TerrainMetaSchema);
  const buffer = await (await fetchData(meta.file)).arrayBuffer();
  const worker = new Worker(new URL("./terrain.worker.ts", import.meta.url), { type: "module" });
  try {
    const decoded = await new Promise<{ meters: Float32Array; levels: GpuLevel[] }>(
      (resolve, reject) => {
        worker.onmessage = ({ data }: MessageEvent<TerrainWorkerResponse>) => {
          if ("error" in data) reject(new Error(data.error));
          else resolve(data);
        };
        worker.onerror = (event) => reject(new Error(event.message));
        const request: TerrainWorkerRequest = {
          buffer,
          width: meta.width,
          height: meta.height,
          quantization: meta.quantization,
          fillRadius: BORDER_FILL_CELLS,
        };
        worker.postMessage(request, [buffer]);
      },
    );
    return { meta, ...decoded };
  } finally {
    worker.terminate();
  }
}

export const useTerrain = (resolution: DemResolution) =>
  useQuery({
    queryKey: ["data", "terrain", resolution],
    queryFn: () => loadTerrain(resolution),
    ...staticData,
  });
