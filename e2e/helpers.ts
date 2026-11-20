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

type StaticFire = { id: number; firedate: string; commune: string; province: string; areaHa: number };

/** Date of the live answer used by the tests: the window runs from November 2025 to October 2026. */
export const LIVE_AS_OF = "2026-10-20T12:00:00.000Z";

/**
 * The live answer of /api/effis/recent, rebuilt from the published files (same
 * encoding, same fields): the tests never depend on EFFIS being reachable.
 */
export function liveFires(): { generatedAt: string; from: string; encoding: string; fires: StaticFire[] } {
  const fires = [2025, 2026]
    .flatMap((year) => publicJson<{ fires: StaticFire[] }>(`effis/fires-${year}.json`).fires)
    // 1 November 2025, 00:00 in Paris.
    .filter((fire) => fire.firedate >= "2025-10-31T23:00:00.000Z" && fire.firedate <= LIVE_AS_OF);
  return { generatedAt: LIVE_AS_OF, from: "2025-11-01", encoding: "scene-10m-delta", fires };
}

/** Answers both server routes locally (EFFIS twelve months, FIRMS 72 hours), or makes EFFIS fail. */
export async function mockLive(
  page: import("@playwright/test").Page,
  { effis = true, effisDelayMs = 0 }: { effis?: boolean; effisDelayMs?: number } = {},
) {
  const body = effis ? JSON.stringify(liveFires()) : JSON.stringify({ error: "indisponible" });
  await page.route("**/api/effis/recent", async (route) => {
    if (effisDelayMs) await new Promise((resolve) => setTimeout(resolve, effisDelayMs));
    await route.fulfill({ status: effis ? 200 : 503, contentType: "application/json", body });
  });
  const minutes = Date.parse(LIVE_AS_OF) / 60_000;
  await page.route("**/api/firms/recent", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        generatedAt: LIVE_AS_OF,
        hours: 72,
        satellites: ["NOAA-20"],
        count: 2,
        x: [-60, -61],
        z: [80, 81],
        t: [minutes - 60, minutes - 600],
        frp: [12, 3.5],
      }),
    }),
  );
}
