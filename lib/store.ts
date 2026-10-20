import { create } from "zustand";

/** "explore": free camera and map furniture; "story": camera driven by the narrative. */
export type MapMode = "explore" | "story";

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
  setRenderMode: (renderMode: "3d" | "2d" | null) => void;
  setView: (view: { kmPer100px: number | null; northDeg: number }) => void;
  setCursor: (cursor: CursorReadout | null) => void;
  setYear: (year: number) => void;
  setShowHistory: (showHistory: boolean) => void;
  selectFire: (id: number | null) => void;
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
  setRenderMode: (renderMode) => set({ renderMode }),
  setView: (view) => set(view),
  setCursor: (cursor) => set({ cursor }),
  // A selection belongs to one year: changing year clears it.
  setYear: (year) => set({ year, selectedFireId: null }),
  setShowHistory: (showHistory) => set({ showHistory }),
  selectFire: (selectedFireId) => set({ selectedFireId }),
}));
