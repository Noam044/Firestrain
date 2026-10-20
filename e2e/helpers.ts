import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Published data, read from disk so the tests never hard-code a figure. */
export function publicJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(import.meta.dirname, "..", "public", "data", path), "utf8")) as T;
}

/** "98 459" as French formatting prints it (narrow no-break space), as a tolerant pattern. */
export function frenchNumber(value: number): RegExp {
  const digits = Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "[\\s\\u202f\\u00a0]");
  return new RegExp(digits);
}
