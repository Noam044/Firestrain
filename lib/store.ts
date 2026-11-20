import { create } from "zustand";
import type { BasemapId } from "./geo/basemaps.ts";

/** Archive years published as static files (EFFIS, 02-effis). */
export const FIRST_YEAR = 2006;
export const LAST_YEAR = 2026;

export type CursorReadout = {
  lon: number;
  lat: number;
  /** Lambert-93 metres. */
  x: number;
  y: number;
  inFrance: boolean;
  /** BD ALTI elevation at the DEM cell under the cursor, null when absent. */
  altitudeM: number | null;
};

export type FireSort = "date" | "area";

type MapState = {
  /** Renderer actually on screen: the map furniture adapts to it. */
  renderMode: "3d" | "2d" | null;
  /** Vertical exaggeration of the relief, shown in the legend. */
  exaggeration: number;
  /** Ground distance covered by 100 CSS px at the centre of the view. */
  kmPer100px: number | null;
  /** Screen angle of geographic north, clockwise from up. */
  northDeg: number;
  cursor: CursorReadout | null;
  /** null: the last twelve months (live); a year: that calendar year of the archives. */
  archiveYear: number | null;
  /** Month shown, as an index in the window (0 = oldest); null shows the twelve months. */
  month: number | null;
  /** EFFIS id of the selected fire (from the window shown). */
  selectedFireId: number | null;
  /** Fire under the pointer, on the map (with its screen position, for the tooltip) or in the list. */
  hover: { id: number; x: number; y: number } | { id: number; x: null; y: null } | null;
  /** Fires of the window drawn before the window (hatched), since 2006. */
  showHistory: boolean;
  /** FIRMS hotspots of the last 72 hours (server route), live view only. */
  showLive: boolean;
  /** Order of the fire list. */
  sort: FireSort;
  /** Base map under the burnt areas. */
  basemap: BasemapId;
  /** One-shot camera move, consumed by the 3D camera rig. */
  cameraRequest: CameraRequest | null;
  setRenderMode: (renderMode: "3d" | "2d" | null) => void;
  setView: (view: { kmPer100px: number | null; northDeg: number }) => void;
  setCursor: (cursor: CursorReadout | null) => void;
  setArchiveYear: (year: number | null) => void;
  setMonth: (month: number | null) => void;
  selectFire: (id: number | null) => void;
  setHover: (hover: MapState["hover"]) => void;
  setShowHistory: (showHistory: boolean) => void;
  setShowLive: (showLive: boolean) => void;
  setSort: (sort: FireSort) => void;
  setBasemap: (basemap: BasemapId) => void;
  requestCamera: (target: CameraRequest["target"]) => void;
};

export type CameraRequest = {
  id: number;
  target:
    | { kind: "preset"; preset: string }
    | { kind: "bbox"; bbox: readonly [number, number, number, number] }
    /** Map buttons: > 1 zooms in, < 1 zooms out. */
    | { kind: "zoom"; factor: number };
};

export const useMapStore = create<MapState>()((set) => ({
  renderMode: null,
  exaggeration: 4,
  kmPer100px: null,
  northDeg: 0,
  cursor: null,
  archiveYear: null,
  month: null,
  selectedFireId: null,
  hover: null,
  showHistory: false,
  showLive: true,
  sort: "date",
  basemap: "relief",
  cameraRequest: null,
  setRenderMode: (renderMode) => set({ renderMode }),
  setView: (view) => set(view),
  setCursor: (cursor) => set({ cursor }),
  // Months and a selection belong to one window: changing window clears them.
  setArchiveYear: (archiveYear) => set({ archiveYear, month: null, selectedFireId: null, hover: null }),
  setMonth: (month) => set({ month }),
  selectFire: (selectedFireId) => set({ selectedFireId }),
  setHover: (hover) => set({ hover }),
  setShowHistory: (showHistory) => set({ showHistory }),
  setShowLive: (showLive) => set({ showLive }),
  setSort: (sort) => set({ sort }),
  setBasemap: (basemap) => set({ basemap }),
  requestCamera: (target) => set((state) => ({ cameraRequest: { id: (state.cameraRequest?.id ?? 0) + 1, target } })),
}));
