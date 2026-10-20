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
