import { expect, test } from "@playwright/test";
import { mockLive } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockLive(page);
});

test("la liste des départements mène à une page par département, et de là à la carte", async ({ page }) => {
  await page.goto("/departements");
  await expect(page.getByRole("heading", { level: 1, name: "Les feux par département" })).toBeVisible();
  await page.getByRole("link", { name: /Gironde/ }).first().click();
  await expect(page).toHaveURL(/\/departement\/gironde$/);
  await expect(page.getByRole("heading", { level: 1, name: /Gironde/ })).toBeVisible();
  await expect(page.getByRole("img", { name: "Feux cartographiés, Gironde" })).toBeVisible();
  const largest = page.getByRole("table").getByRole("link").first();
  const name = (await largest.textContent())!.trim();
  await largest.click();
  await expect(page).toHaveURL(/\/carte\?annee=\d{4}&fire=\d+/);
  await expect(page.locator("#feu-titre")).toHaveText(name);
  // The fire card leads back to its département.
  await page.getByRole("link", { name: "Gironde" }).click();
  await expect(page).toHaveURL(/\/departement\/gironde$/);
});

test("un département sans feu le dit", async ({ page }) => {
  await page.goto("/departement/paris");
  await expect(page.getByText(/EFFIS n’a cartographié aucun feu dans ce département/)).toBeVisible();
});
