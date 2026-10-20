/**
 * The timeline runs from 1 June (day 1) to 30 September (day 122) of the year
 * shown. Day indices match the burn mask and the FIRMS detections.
 */
export const TIMELINE_DAYS = 122;

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" of a timeline day (fractions are floored). */
export function dateOfTimelineDay(year: number, day: number): string {
  const clamped = Math.min(TIMELINE_DAYS, Math.max(1, Math.floor(day)));
  return new Date(Date.UTC(year, 5, 1) + (clamped - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** Timeline day of "YYYY-MM-DD" in that year, or null outside 1 June – 30 September. */
export function timelineDayOfDate(year: number, date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || Number(match[1]) !== year) return null;
  const day = Math.round((Date.UTC(year, Number(match[2]) - 1, Number(match[3])) - Date.UTC(year, 5, 1)) / DAY_MS) + 1;
  return day >= 1 && day <= TIMELINE_DAYS ? day : null;
}
