import { expect, test } from "@playwright/test";
import { frenchNumber, publicJson } from "./helpers";

type Year = { fires: { id: number; commune: string; areaHa: number }[] };
const fires = publicJson<Year>("effis/fires-2026.json").fires;
const largest = [...fires].sort((a, b) => b.areaHa - a.areaHa)[0];

test("un feu passé dans l'adresse ouvre son panneau", async ({ page }) => {
  await page.goto(`/?year=2026&fire=${largest.id}`);
  const title = page.locator("#feu-titre");
  await expect(title).toHaveText(largest.commune);
  await expect(page.getByText(frenchNumber(largest.areaHa)).first()).toBeVisible();
  await expect(page.getByText(/Première détection satellite le/)).toBeVisible();
  // Back to the year.
  await page.getByRole("button", { name: "Toutes les surfaces de 2026" }).click();
  await expect(page.locator("#feu-titre")).toHaveCount(0);
  await expect(page).not.toHaveURL(/fire=/);
});

test("la liste des plus grandes surfaces ouvre le feu", async ({ page }) => {
  await page.goto("/?year=2026");
  await page.locator("#grands-titre").locator("../..").getByRole("button").first().click();
  await expect(page.locator("#feu-titre")).toHaveText(largest.commune);
  await expect(page).toHaveURL(new RegExp(`fire=${largest.id}`));
});

test("un identifiant inconnu est ignoré", async ({ page }) => {
  await page.goto("/?year=2026&fire=1");
  await expect(page.locator("#bilan-titre")).toHaveText("2026");
  await expect(page.locator("#feu-titre")).toHaveCount(0);
});
