import { expect, test } from "@playwright/test";
import { frenchNumber, publicJson } from "./helpers";

type Year = { fires: { id: number; commune: string; areaHa: number }[] };
const fires = publicJson<Year>("effis/fires-2026.json").fires;
const largest = [...fires].sort((a, b) => b.areaHa - a.areaHa)[0];

test("un feu passé dans l'adresse ouvre son panneau", async ({ page }) => {
  await page.goto(`/explorer?year=2026&fire=${largest.id}`);
  const title = page.locator("#feu-titre");
  await expect(title).toHaveText(largest.commune);
  await expect(page.getByText(frenchNumber(largest.areaHa)).first()).toBeVisible();
  await expect(page.getByText("Première détection satellite")).toBeVisible();
});

test("un identifiant inconnu est ignoré", async ({ page }) => {
  await page.goto("/explorer?year=2026&fire=1");
  await expect(page.getByText("Sélectionnez une surface brûlée", { exact: false })).toBeVisible();
  await expect(page.locator("#feu-titre")).toHaveCount(0);
});
