import { expect, test } from "@playwright/test";

test("rendu 2D demandé dans l'adresse", async ({ page }) => {
  await page.goto("/explorer?rendu=2d");
  await expect(page.getByText("Rendu 2D demandé dans l’adresse")).toBeVisible();
  await expect(page.locator("svg title", { hasText: "carte 2D" })).toHaveCount(1);
});

test("sans WebGL 2, la carte 2D prend le relais", async ({ page }) => {
  // Simulates a browser without WebGL 2 before any script runs.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === "webgl2") return null;
      return (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof original;
  });
  await page.goto("/explorer?year=2026");
  await expect(page.getByText("WebGL 2 n’est pas disponible", { exact: false })).toBeVisible();
  // Burnt areas of the year are drawn and selectable in 2D.
  await expect(page.locator("svg path title").first()).toBeAttached();
});
