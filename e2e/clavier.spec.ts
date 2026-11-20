import { expect, test, type Page } from "@playwright/test";
import { mockLive } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockLive(page);
});

/** Tabs through the page and returns, for each stop, its label and whether a focus ring is drawn. */
async function tabStops(page: Page, count: number) {
  const stops: { label: string; ring: boolean }[] = [];
  for (let k = 0; k < count; k++) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return { label: "body", ring: true };
        const style = getComputedStyle(el);
        const ring = (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2) || style.boxShadow !== "none";
        const label = `${el.tagName.toLowerCase()} « ${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)} »`;
        return { label, ring };
      }),
    );
  }
  return stops;
}

for (const path of ["/", "/carte", "/carte?annee=2022", "/liste?year=2026", "/methode"]) {
  test(`chaque arrêt de tabulation est visible : ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const stops = await tabStops(page, 18);
    const hidden = stops.filter((stop) => !stop.ring).map((stop) => stop.label);
    expect(hidden, `arrêts sans anneau de focus : ${hidden.join(", ")}`).toEqual([]);
    expect(stops.filter((stop) => stop.label !== "body").length).toBeGreaterThan(3);
  });
}

test("la carte se manipule au clavier", async ({ page }) => {
  await page.goto("/carte?rendu=3d");
  const map = page.getByRole("application", { name: /Carte en relief/ });
  await map.focus();
  await expect(map).toBeFocused();
  // Arrow keys are consumed by the map (no page scroll).
  const before = await page.evaluate(() => window.scrollY);
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
});
