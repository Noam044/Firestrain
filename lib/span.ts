/**
 * The time window shown: the last twelve calendar months up to the date of the
 * data, or one calendar year of the archives. Days are counted from the first
 * day of the window (day 1), on local dates in Paris; the burn mask, the map
 * filters and the month strip all use this count.
 */

const DAY_MS = 86_400_000;

export type MonthOfYear = { year: number; month: number };

export type Span =
  | { kind: "recent"; months: MonthOfYear[]; asOf: string }
  | { kind: "year"; year: number; months: MonthOfYear[] };

const parisDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Local date in Paris of an instant, as [year, month, day]. */
export function parisCalendarDate(iso: string): [number, number, number] {
  const [year, month, day] = parisDate.format(new Date(iso)).split("-").map(Number);
  return [year, month, day];
}

/** Days since 1970-01-01 of a calendar date (months past 12 roll over). */
const dayNumber = (year: number, month: number, day: number) => Math.round(Date.UTC(year, month - 1, day) / DAY_MS);

/** The twelve months ending with the month of `asOf` (Paris), oldest first. */
export function recentSpan(asOf: string): Span {
  const [year, month] = parisCalendarDate(asOf);
  const months = Array.from({ length: 12 }, (_, k) => {
    const index = year * 12 + (month - 1) - 11 + k;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
  });
  return { kind: "recent", months, asOf };
}

export function yearSpan(year: number): Span {
  return { kind: "year", year, months: Array.from({ length: 12 }, (_, k) => ({ year, month: k + 1 })) };
}

/** First local date of the window, "YYYY-MM-DD". */
export function spanStartDate(span: Span): string {
  const { year, month } = span.months[0];
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** Day of the window (1 = first day of its first month) of an instant, in Paris. */
export function spanDay(span: Span, iso: string): number {
  const first = span.months[0];
  return dayNumber(...parisCalendarDate(iso)) - dayNumber(first.year, first.month, 1) + 1;
}

/** First and last days of the window covered by month `index` (0 = oldest month). */
export function spanMonthRange(span: Span, index: number): [number, number] {
  const first = span.months[0];
  const { year, month } = span.months[index];
  const start = dayNumber(first.year, first.month, 1);
  return [dayNumber(year, month, 1) - start + 1, dayNumber(year, month + 1, 1) - start];
}

/** Number of days in the window. */
export function spanLength(span: Span): number {
  return spanMonthRange(span, span.months.length - 1)[1];
}

/** Index of the month containing `iso`, or −1 when outside the window. */
export function spanMonthIndex(span: Span, iso: string): number {
  const [year, month] = parisCalendarDate(iso);
  return span.months.findIndex((m) => m.year === year && m.month === month);
}

/** Whole days between two instants' local dates in Paris (b − a). */
export function daysBetween(a: string, b: string): number {
  return dayNumber(...parisCalendarDate(b)) - dayNumber(...parisCalendarDate(a));
}

/** "YYYY-MM" of a month, as used in the address (?mois=2026-07). */
export const monthKey = ({ year, month }: MonthOfYear) => `${year}-${String(month).padStart(2, "0")}`;
