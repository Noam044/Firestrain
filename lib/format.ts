/** French formatting helpers (fr-FR): "42 000 ha", "18 juil. 2026", "44,8408° N". */

const LOCALE = "fr-FR";

const integerFormat = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const decimalFormats = new Map<number, Intl.NumberFormat>();
const dateFormat = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export function formatInteger(value: number): string {
  return integerFormat.format(value);
}

export function formatDecimal(value: number, digits: number): string {
  let format = decimalFormats.get(digits);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    decimalFormats.set(digits, format);
  }
  return format.format(value);
}

export function formatDate(value: string | Date): string {
  return dateFormat.format(typeof value === "string" ? new Date(value) : value);
}

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
function formatDateTimeIn(date: Date, timeZone: string): string {
  let format = dateTimeFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat(LOCALE, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone,
    });
    dateTimeFormats.set(timeZone, format);
  }
  const parts = Object.fromEntries(format.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day} ${parts.month} ${parts.year} à ${parts.hour} h ${parts.minute}`;
}

/** An instant (ISO, UTC) in Paris time: "22 juil. 2026 à 11 h 55". */
export function formatDateTime(iso: string): string {
  return formatDateTimeIn(new Date(iso), "Europe/Paris");
}

/** A local time published without zone ("2025-08-05 16:16"), shown as is. */
export function formatLocalDateTime(local: string): string {
  return formatDateTimeIn(new Date(`${local.replace(" ", "T")}:00Z`), "UTC");
}

export function formatDistance(km: number): string {
  return km >= 1 ? `${formatInteger(km)} km` : `${formatInteger(km * 1000)} m`;
}

export function formatLatitude(lat: number): string {
  return `${formatDecimal(Math.abs(lat), 4)}° ${lat >= 0 ? "N" : "S"}`;
}

export function formatLongitude(lon: number): string {
  return `${formatDecimal(Math.abs(lon), 4)}° ${lon >= 0 ? "E" : "O"}`;
}

const dayMonthFormat = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/** Day and month in Paris, without the year: "14 nov.". */
export function formatDayMonth(iso: string): string {
  return dayMonthFormat.format(new Date(iso));
}

export const MONTH_NAMES = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const MONTH_ABBREVIATIONS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "novembre 2026". */
export function formatMonthYear({ year, month }: { year: number; month: number }): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Age of a fire, in whole days up to the date of the data: "aujourd’hui", "hier", "il y a 5 jours". */
export function formatAge(days: number): string {
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

/** "1 fire" / "12 fires" in French, with the number formatted. */
export function formatCount(count: number, singular: string, plural: string): string {
  return `${formatInteger(count)} ${count > 1 ? plural : singular}`;
}

/** A burnt area in whole hectares; below one hectare, "< 1" rather than a misleading 0. */
export function formatArea(areaHa: number): string {
  return areaHa > 0 && areaHa < 1 ? "< 1" : formatInteger(areaHa);
}
