import { create } from "zustand";
import type { BasemapId } from "./geo/basemaps.ts";

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
  /** Year whose burnt areas are shown in full (charred). */
  year: number;
  /** Earlier years (from FIRST_YEAR) drawn as hatching. */
  showHistory: boolean;
  /** EFFIS id of the selected polygon (always from `year`). */
  selectedFireId: number | null;
  /**
   * Day of the year on the timeline, 1 = 1 January (fractional while playing,
   * for smooth fading); null shows the whole year without FIRMS detections.
   */
  timelineDay: number | null;
  /** FIRMS detections of the last 72 hours (server route), for the current year only. */
  showRecent: boolean;
  /**
   * Month filter (1–12): only the burnt areas first detected that month are shown.
   * Exclusive with the day-by-day timeline. Kept when the year changes, to compare.
   */
  month: number | null;
  /** Burnt area under the pointer, with its screen position, for the tooltip. */
  hover: { id: number; x: number; y: number } | null;
  /** Base map under the burnt areas. */
  basemap: BasemapId;
  playing: boolean;
  /** Playback speed, in timeline days per second. */
  speed: number;
  /** One-shot camera move, consumed by the 3D camera rig. */
  cameraRequest: CameraRequest | null;
  setRenderMode: (renderMode: "3d" | "2d" | null) => void;
  setView: (view: { kmPer100px: number | null; northDeg: number }) => void;
  setCursor: (cursor: CursorReadout | null) => void;
  setYear: (year: number) => void;
  setShowHistory: (showHistory: boolean) => void;
  selectFire: (id: number | null) => void;
  setTimelineDay: (day: number | null) => void;
  setShowRecent: (showRecent: boolean) => void;
  setMonth: (month: number | null) => void;
  setHover: (hover: MapState["hover"]) => void;
  setBasemap: (basemap: BasemapId) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
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
  year: LAST_YEAR,
  showHistory: true,
  selectedFireId: null,
  timelineDay: null,
  showRecent: false,
  month: null,
  hover: null,
  basemap: "relief",
  playing: false,
  speed: 7,
  cameraRequest: null,
  setRenderMode: (renderMode) => set({ renderMode }),
  setView: (view) => set(view),
  setCursor: (cursor) => set({ cursor }),
  // A selection belongs to one year: changing year clears it.
  setYear: (year) => set((state) => ({ year, selectedFireId: null, showRecent: state.showRecent && year === LAST_YEAR })),
  setShowHistory: (showHistory) => set({ showHistory }),
  selectFire: (selectedFireId) => set({ selectedFireId }),
  // The timeline, the month filter and the last 72 hours are exclusive views of time.
  setTimelineDay: (timelineDay) =>
    set(timelineDay === null ? { timelineDay, playing: false } : { timelineDay, showRecent: false, month: null }),
  setMonth: (month) => set(month === null ? { month } : { month, timelineDay: null, playing: false, showRecent: false }),
  setHover: (hover) => set({ hover }),
  setBasemap: (basemap) => set({ basemap }),
  setShowRecent: (showRecent) =>
    set(showRecent ? { showRecent, timelineDay: null, playing: false, month: null } : { showRecent }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  requestCamera: (target) => set((state) => ({ cameraRequest: { id: (state.cameraRequest?.id ?? 0) + 1, target } })),
}));
