import { expect, test } from "@playwright/test";
import { frenchNumber, liveFires, mockLive, publicJson } from "./helpers";

type Index = { years: { year: number; fires: number }[] };
const index = publicJson<Index>("effis/index.json");
const live = liveFires().fires;

test.beforeEach(async ({ page }) => {
  await mockLive(page);
});

test("la carte s'ouvre sur les 12 derniers mois, avec la date des données", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Feux de forêt en France/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Les 12 derniers mois" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /12 mois/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText(/interrogé le 20 oct\. 2026/)).toBeVisible();
  const summary = page.getByRole("complementary", { name: "Feux de la période" });
  await expect(summary.getByText(frenchNumber(live.length)).first()).toBeVisible();
  // The hotspots of the last 72 hours, counted in the top bar.
  await expect(page.getByRole("button", { name: /2 points chauds/ })).toHaveAttribute("aria-pressed", "true");
});

test("les mois se choisissent à la souris et au clavier, et se partagent", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: /^juillet 2026 :/ }).click();
  await expect(page).toHaveURL(/mois=2026-07/);
  await expect(page.getByRole("heading", { level: 2, name: "Juillet 2026" })).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /^août 2026 :/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /^août 2026 :/ })).toBeFocused();
  await expect(page).toHaveURL(/mois=2026-08/);
  await page.getByRole("radio", { name: /12 mois/ }).click();
  await expect(page).not.toHaveURL(/mois=/);
});

test("les archives montrent une année civile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: /Archives/ }).selectOption("2022");
  await expect(page).toHaveURL(/annee=2022/);
  await expect(page.getByRole("heading", { level: 2, name: "Année 2022" })).toBeVisible();
  const fires = index.years.find((y) => y.year === 2022)!.fires;
  await expect(page.getByRole("complementary", { name: "Feux de la période" }).getByText(frenchNumber(fires)).first()).toBeVisible();
  await page.getByRole("button", { name: "12 derniers mois" }).click();
  await expect(page).not.toHaveURL(/annee=/);
});

test("si le suivi en direct ne répond pas, les fichiers du site prennent le relais", async ({ page }) => {
  await page.unrouteAll();
  await mockLive(page, { effis: false });
  await page.goto("/");
  await expect(page.getByText(/Le suivi en direct ne répond pas/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Feux de la période" }).getByRole("button").first()).toBeVisible();
});

test("l'ancienne adresse /explorer mène à la carte", async ({ page }) => {
  await page.goto("/explorer?year=2022");
  await expect(page).toHaveURL(/\/\?(year|annee)=2022/);
  await expect(page.getByRole("heading", { level: 2, name: "Année 2022" })).toBeVisible();
});
