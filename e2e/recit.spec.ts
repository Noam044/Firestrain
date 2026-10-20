import { expect, test } from "@playwright/test";
import { frenchNumber, publicJson } from "./helpers";

type Story = { headline: { areaHa: number }; events: { id: string; effis: { areaHa: number } }[] };
const story = publicJson<Story>("story/story.json");

test("le récit se charge avec le chiffre de l'année et sa source", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "FireStrain" })).toBeVisible();
  await expect(page.locator("#ouverture-titre ~ p").filter({ hasText: frenchNumber(story.headline.areaHa) }).first()).toBeVisible();
  await expect(page.locator("#ouverture-titre").locator("..").getByText(/donnée du/).first()).toBeVisible();
  // Smooth scrolling runs by default (the reduced-motion test checks the opposite).
  await expect(page.locator("html")).toHaveClass(/lenis/);
});

test("le défilement mène à la Gironde, avec des faits sourcés", async ({ page }) => {
  await page.goto("/");
  const gironde = page.locator('[data-step="gironde"]');
  await gironde.scrollIntoViewIfNeeded();
  await expect(gironde.getByRole("heading", { name: /Gironde/ })).toBeVisible();
  const area = story.events.find((e) => e.id === "gironde")!.effis.areaHa;
  await expect(gironde.getByText(frenchNumber(area)).first()).toBeVisible();
  await expect(gironde.getByText("Préfecture de la Gironde").first()).toBeVisible();
  // The date chip follows the scroll.
  await expect(page.getByText(/juil\. 2026/).first()).toBeVisible();
});

test("avec prefers-reduced-motion : pas de défilement doux, compteur figé", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "FireStrain" })).toBeVisible();
  // Lenis marks <html> when it runs; it must not with reduced motion.
  await expect(page.locator("html")).not.toHaveClass(/lenis/);
  // The counter shows the final figure at once.
  await expect(page.locator('span[aria-hidden="true"]').filter({ hasText: frenchNumber(story.headline.areaHa) }).first()).toBeVisible();
  await context.close();
});
