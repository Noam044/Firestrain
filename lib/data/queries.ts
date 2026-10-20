import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import {
  BordersSchema,
  Departements2DSchema,
  FranceOutlineSchema,
  TerrainMetaSchema,
  type TerrainMeta,
} from "./schemas.ts";
import type { GpuLevel, TerrainWorkerRequest, TerrainWorkerResponse } from "./terrain.worker.ts";

/** Static files never change during a visit. */
const staticData = { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY, retry: 1 };

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
