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

test("le mode Départements remplace les feux par les départements, et un clic en choisit un", async ({ page }) => {
  // Headless Chrome draws the 2D map, which has the same département mode.
  await page.goto("/carte?rendu=2d");
  await expect(page.getByRole("progressbar", { name: "Chargement des données satellite" })).toBeHidden();
  const toggle = page.getByRole("button", { name: "Départements" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  // The fire markers step back.
  await expect(page.locator("svg circle.cursor-pointer")).toHaveCount(0);
  const gironde = page.locator("svg path", { has: page.locator("title", { hasText: "Gironde (33)" }) });
  await gironde.hover({ force: true });
  await expect(page.getByRole("tooltip")).toContainText("Gironde");
  await gironde.click({ force: true });
  await expect(page).toHaveURL(/dep=gironde/);
  const panel = page.getByRole("complementary", { name: "Feux de la période" });
  await expect(panel.getByRole("button", { name: "Toute la France" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Page du département" })).toHaveAttribute("href", "/departement/gironde");
  for (const province of await panel.getByRole("list", { name: "Feux de la période" }).locator("li").allInnerTexts()) {
    expect(province).toContain("Gironde");
  }
  await panel.getByRole("button", { name: "Toute la France" }).click();
  await expect(page).not.toHaveURL(/dep=/);
});

test("une adresse ?dep= ouvre la carte sur le département", async ({ page }) => {
  await page.goto("/carte?dep=gironde");
  const panel = page.getByRole("complementary", { name: "Feux de la période" });
  await expect(panel.getByRole("button", { name: "Toute la France" })).toBeVisible();
  await expect(panel.locator("p.label", { hasText: "Gironde" })).toBeVisible();
});
