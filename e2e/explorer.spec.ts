import { expect, test } from "@playwright/test";
import { frenchNumber, publicJson } from "./helpers";

type Index = { years: { year: number; areaHaAtLeast30: number }[] };
const index = publicJson<Index>("effis/index.json");

test("changer d'année met à jour le total et l'adresse", async ({ page }) => {
  await page.goto("/explorer");
  await page.getByRole("combobox", { name: "Année affichée" }).click();
  await page.getByRole("option", { name: "2022" }).click();
  const total = index.years.find((y) => y.year === 2022)!.areaHaAtLeast30;
  await expect(page.getByText(frenchNumber(total)).first()).toBeVisible();
  await expect(page).toHaveURL(/year=2022/);
});

test("la frise se pilote au clavier", async ({ page }) => {
  await page.goto("/explorer?year=2026");
  const thumb = page.getByRole("slider", { name: "Date affichée" });
  await thumb.focus();
  await page.keyboard.press("Home");
  await expect(thumb).toHaveAttribute("aria-valuetext", /1 janv\. 2026/);
  await page.keyboard.press("ArrowRight");
  await expect(thumb).toHaveAttribute("aria-valuetext", /2 janv\. 2026/);
  await expect(page).toHaveURL(/date=2026-01-02/);
  await page.getByRole("button", { name: "Toute l’année" }).click();
  await expect(page.getByText("Année 2026 entière")).toBeVisible();
});

test("la liste des feux est proposée comme alternative à la carte", async ({ page }) => {
  await page.goto("/explorer");
  await page.keyboard.press("Tab"); // skip link of the layout
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /liste des feux/i }).first()).toBeAttached();
});
