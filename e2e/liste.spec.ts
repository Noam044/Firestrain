import { expect, test } from "@playwright/test";
import { frenchNumber, publicJson } from "./helpers";

type Index = { years: { year: number; firesAtLeast30: number; areaHaAtLeast30: number }[] };
const entry = publicJson<Index>("effis/index.json").years.find((y) => y.year === 2026)!;

test("la liste reprend le total officiel et mène à la carte", async ({ page }) => {
  await page.goto("/liste?year=2026");
  await expect(page.getByText(`${entry.firesAtLeast30} surfaces`)).toBeVisible();
  await expect(page.getByText(frenchNumber(entry.areaHaAtLeast30)).first()).toBeVisible();
  // Sorting by commune toggles aria-sort.
  const header = page.getByRole("columnheader", { name: /Commune/ });
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  await page.getByRole("link", { name: /voir sur la carte/ }).first().click();
  await expect(page).toHaveURL(/\/\?annee=2026&fire=\d+/);
  await expect(page.locator("#feu-titre")).toBeVisible();
});

test("filtrer par département", async ({ page }) => {
  await page.goto("/liste?year=2026");
  await page.getByRole("searchbox", { name: /Commune ou département/ }).fill("Var");
  const rows = page.locator("tbody tr");
  await expect(rows.first()).toContainText("Var");
});
