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
