import type { LonLat } from "./frame.ts";

export type CameraPreset = {
  label: string;
  /** Point looked at, on the ground. */
  target: LonLat;
  distanceKm: number;
  /** Angle from the vertical: 0 = straight down. */
  polarDeg: number;
  /** Clockwise from north: 0 = looking north from the south. */
  azimuthDeg: number;
};

export const CAMERA_PRESETS = {
  france: {
    label: "France entière",
    target: [3.2, 45.45],
    distanceKm: 1900,
    polarDeg: 38,
    azimuthDeg: 0,
  },
  // Targets: centres of the EFFIS 2026 outlines of the fires (computed on 2026-10-20).
  gironde: {
    label: "Gironde (feu du Porge, juillet 2026)",
    target: [-1.015, 44.841],
    distanceKm: 130,
    polarDeg: 45,
    azimuthDeg: 0,
  },
  "pyrenees-orientales": {
    label: "Pyrénées-Orientales (feu de Trévillach, juillet 2026)",
    target: [2.57, 42.668],
    distanceKm: 60,
    polarDeg: 48,
    azimuthDeg: 0,
  },
  var: {
    label: "Var (Pontevès – Correns, juillet–août 2026)",
    target: [6.08, 43.51],
    distanceKm: 65,
    polarDeg: 48,
    azimuthDeg: 0,
  },
  /** Opening of the story: same view, slightly farther, beside the title column. */
  franceStory: {
    label: "France entière (récit)",
    target: [3.2, 45.45],
    distanceKm: 2100,
    polarDeg: 40,
    azimuthDeg: 0,
  },
} as const satisfies Record<string, CameraPreset>;

export type CameraPresetId = keyof typeof CAMERA_PRESETS;
