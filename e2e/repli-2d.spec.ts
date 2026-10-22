import { expect, test } from "@playwright/test";

test("rendu 2D demandé dans l'adresse", async ({ page }) => {
  await page.goto("/?rendu=2d");
  await expect(page.getByText("rendu 2D demandé dans l’adresse", { exact: false })).toBeVisible();
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
  await page.goto("/?year=2026");
  await expect(page.getByText("WebGL 2 n’est pas disponible", { exact: false })).toBeVisible();
  // Burnt areas of the year are drawn and selectable in 2D.
  await expect(page.locator("svg path title").first()).toBeAttached();
});

test("sans accélération graphique, la 2D est choisie ; rendu=3d force le relief", async ({ page }) => {
  // Headless Chrome renders WebGL in software (SwiftShader): the 2D map is chosen.
  await page.goto("/?year=2026");
  const software = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    return /SwiftShader|llvmpipe/i.test(String(gl && info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : ""));
  });
  test.skip(!software, "navigateur avec accélération graphique");
  await expect(page.getByText("Pas d’accélération graphique", { exact: false })).toBeVisible();
  await page.goto("/?year=2026&rendu=3d");
  await expect(page.locator("canvas")).toBeAttached();
  await expect(page.getByRole("application", { name: /Carte en relief/ })).toBeAttached();
});
