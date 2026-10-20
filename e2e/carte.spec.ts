import { expect, test } from "@playwright/test";
import { frenchNumber, publicJson } from "./helpers";

type Index = { years: { year: number; areaHaAtLeast30: number; firesAtLeast30: number }[] };
const index = publicJson<Index>("effis/index.json");
const total = (year: number) => index.years.find((y) => y.year === year)!.areaHaAtLeast30;

test("la carte s'ouvre sur la dernière année, avec son total EFFIS", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Feux de forêt en France" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /^2026 :/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#bilan-titre").locator("..").getByText(frenchNumber(total(2026))).first()).toBeVisible();
});

test("la frise des années change l'année, à la souris et au clavier", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: /^2022 :/ }).click();
  await expect(page).toHaveURL(/year=2022/);
  await expect(page.locator("#bilan-titre")).toHaveText("2022");
  await expect(page.locator("#bilan-titre").locator("..").getByText(frenchNumber(total(2022))).first()).toBeVisible();
  // Arrow keys move along the years.
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("radio", { name: /^2021 :/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /^2021 :/ })).toBeFocused();
  await expect(page).toHaveURL(/year=2021/);
});

test("un mois filtre la carte, et « Toute l’année » revient en arrière", async ({ page }) => {
  await page.goto("/?year=2026");
  await page.getByRole("button", { name: /^juillet :/ }).click();
  await expect(page).toHaveURL(/mois=7/);
  await expect(page.locator("#bilan-titre")).toHaveText("Juillet 2026");
  await page.getByRole("button", { name: "Toute l’année" }).click();
  await expect(page).not.toHaveURL(/mois=/);
  await expect(page.locator("#bilan-titre")).toHaveText("2026");
});

test("la lecture jour par jour se pilote au clavier", async ({ page }) => {
  await page.goto("/?year=2026");
  const thumb = page.getByRole("slider", { name: "Jour affiché" });
  await thumb.focus();
  await page.keyboard.press("Home");
  await expect(thumb).toHaveAttribute("aria-valuetext", /1 janv\. 2026/);
  await page.keyboard.press("ArrowRight");
  await expect(thumb).toHaveAttribute("aria-valuetext", /2 janv\. 2026/);
  await expect(page).toHaveURL(/date=2026-01-02/);
  await expect(page.locator("#bilan-titre")).toContainText("Du 1er janvier au 2 janv.");
});

test("l'ancienne adresse /explorer mène à la carte", async ({ page }) => {
  await page.goto("/explorer?year=2022");
  await expect(page).toHaveURL(/\/\?year=2022/);
  await expect(page.locator("#bilan-titre")).toHaveText("2022");
});
