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

export function formatDistance(km: number): string {
  return km >= 1 ? `${formatInteger(km)} km` : `${formatInteger(km * 1000)} m`;
}

export function formatLatitude(lat: number): string {
  return `${formatDecimal(Math.abs(lat), 4)}° ${lat >= 0 ? "N" : "S"}`;
}

export function formatLongitude(lon: number): string {
  return `${formatDecimal(Math.abs(lon), 4)}° ${lon >= 0 ? "E" : "O"}`;
}
