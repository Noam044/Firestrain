import { expect, test } from "@playwright/test";
import { frenchNumber, liveFires, mockLive } from "./helpers";

const largest = [...liveFires().fires].sort((a, b) => b.areaHa - a.areaHa)[0];

test.beforeEach(async ({ page }) => {
  await mockLive(page);
});

test("un feu passé dans l'adresse ouvre sa fiche", async ({ page }) => {
  await page.goto(`/carte?fire=${largest.id}`);
  const title = page.locator("#feu-titre");
  await expect(title).toHaveText(largest.commune);
  await expect(page.getByText(frenchNumber(largest.areaHa)).first()).toBeVisible();
  await expect(page.getByText(/Première détection satellite/)).toBeVisible();
  await page.getByRole("button", { name: "Tous les feux" }).click();
  await expect(page.locator("#feu-titre")).toHaveCount(0);
  await expect(page).not.toHaveURL(/fire=/);
});

test("la liste triée par surface ouvre le plus grand feu", async ({ page }) => {
  await page.goto("/carte");
  await page.getByRole("button", { name: "Plus grands" }).click();
  await page.getByRole("list", { name: "Feux de la période" }).getByRole("button").first().click();
  await expect(page.locator("#feu-titre")).toHaveText(largest.commune);
  await expect(page).toHaveURL(new RegExp(`fire=${largest.id}`));
});

test("la recherche filtre la liste par commune", async ({ page }) => {
  await page.goto("/carte");
  await page.getByRole("searchbox", { name: /Chercher une commune/ }).fill(largest.commune);
  await expect(page.getByRole("list", { name: "Feux de la période" }).getByRole("button").first()).toContainText(largest.commune);
});

test("un identifiant inconnu est ignoré", async ({ page }) => {
  await page.goto("/carte?fire=1");
  await expect(page.getByRole("heading", { level: 2, name: "Les 12 derniers mois" })).toBeVisible();
  await expect(page.locator("#feu-titre")).toHaveCount(0);
});
