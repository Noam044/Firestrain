/**
 * The timeline covers the whole calendar year shown: day 1 = 1 January.
 * Day indices match the burn mask and the FIRMS detections (local dates in Paris).
 */

const DAY_MS = 86_400_000;

export function daysInYear(year: number): number {
  return Math.round((Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY_MS);
}

/** "YYYY-MM-DD" of a timeline day (fractions are floored, out-of-range days clamped). */
export function dateOfTimelineDay(year: number, day: number): string {
  const clamped = Math.min(daysInYear(year), Math.max(1, Math.floor(day)));
  return new Date(Date.UTC(year, 0, 1) + (clamped - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** Timeline day of "YYYY-MM-DD" in that year, or null for another year or a malformed date. */
export function timelineDayOfDate(year: number, date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || Number(match[1]) !== year) return null;
  const day = Math.round((Date.UTC(year, Number(match[2]) - 1, Number(match[3])) - Date.UTC(year, 0, 1)) / DAY_MS) + 1;
  return day >= 1 && day <= daysInYear(year) ? day : null;
}
