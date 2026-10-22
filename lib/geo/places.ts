import type { LonLat } from "./frame.ts";

/** Names written on the map for orientation: neighbouring countries and seas, placed away from France. */
export const MAP_LABELS: readonly { name: string; at: LonLat; kind: "country" | "sea" }[] = [
  { name: "Espagne", at: [-2.4, 41.9], kind: "country" },
  { name: "Italie", at: [8.7, 44.9], kind: "country" },
  { name: "Suisse", at: [8.1, 46.8], kind: "country" },
  { name: "Allemagne", at: [8.9, 49.9], kind: "country" },
  { name: "Belgique", at: [4.7, 50.7], kind: "country" },
  { name: "Royaume-Uni", at: [-1.2, 51.15], kind: "country" },
  { name: "Océan Atlantique", at: [-4.8, 45.6], kind: "sea" },
  { name: "Manche", at: [-1.9, 50.0], kind: "sea" },
  { name: "Mer Méditerranée", at: [5.2, 42.3], kind: "sea" },
];
