/**
 * Fire markers: one disc per burnt area, area ∝ burnt area (plus a floor so
 * small fires stay visible), coloured by age. Shared by the 3D layer, its
 * hit test and the 2D map, so a disc is the same size everywhere.
 */

/** Marker radius in CSS px. */
export function markerRadius(areaHa: number): number {
  return Math.min(30, 4 + 0.22 * Math.sqrt(areaHa));
}

/** Radius of a disc of the burnt area, km: once the outline is drawn larger than the marker, the marker fades out. */
export function realRadiusKm(areaHa: number): number {
  return Math.sqrt((areaHa * 0.01) / Math.PI);
}

/** Opacity of a marker whose outline would be `realPx` CSS px wide (radius) on screen. */
export function markerFade(radiusPx: number, realPx: number): number {
  const t = Math.min(1, Math.max(0, (realPx - 0.7 * radiusPx) / (0.6 * radiusPx)));
  return 1 - t * t * (3 - 2 * t);
}

/** Age classes of the live view: first detected less than a week ago, less than a month ago, earlier. */
export const AGE_CLASSES = [
  { maxDays: 7, label: "Moins de 7 jours", token: "--fire-new" },
  { maxDays: 31, label: "Moins d’un mois", token: "--fire-month" },
  { maxDays: Number.POSITIVE_INFINITY, label: "Plus ancien", token: "--fire-old" },
] as const;

/** Age class index; archive fires (no age) use the month class, the plain fire red. */
export function ageClass(ageDays: number | null): number {
  if (ageDays === null) return 1;
  return AGE_CLASSES.findIndex((c) => ageDays <= c.maxDays);
}
