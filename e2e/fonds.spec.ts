import { expect, test, type Page } from "@playwright/test";

// Imagery requests are answered locally: the tests do not depend on the IGN service.
const offline = (page: Page) =>
  page.route("https://data.geopf.fr/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: Buffer.alloc(0) }));

test("le fond de carte se choisit et se partage dans l'adresse", async ({ page }) => {
  await offline(page);
  await page.goto("/carte?annee=2026&rendu=2d");
  await page.getByRole("button", { name: /Fond et calques\s*Relief/ }).click();
  const picker = page.getByRole("radiogroup", { name: "Fond de carte" });
  await expect(picker.getByRole("radio", { name: "Relief" })).toHaveAttribute("aria-checked", "true");
  // Satellite (SPOT, WMS only: several seconds per image) is no longer offered.
  await expect(picker.getByRole("radio", { name: "Satellite" })).toHaveCount(0);
  await picker.getByRole("radio", { name: "Photos aériennes" }).click();
  await expect(picker.getByRole("radio", { name: "Photos aériennes" })).toHaveAttribute("aria-checked", "true");
  await expect(page).toHaveURL(/fond=ortho/);
  // Its source in the picker, and the site's whole-France image in the 2D map.
  await expect(page.getByText(/BD ORTHO/).first()).toBeVisible();
  await expect(page.locator("svg image")).toHaveAttribute("href", /\/data\/fonds\/ortho-france\.jpg/);
  await picker.getByRole("radio", { name: "Relief" }).click();
  await expect(page).not.toHaveURL(/fond=/);
  await expect(page.locator("svg image")).toHaveCount(0);
});

test("un fond passé dans l'adresse est appliqué", async ({ page }) => {
  await offline(page);
  await page.goto("/carte?annee=2026&rendu=2d&fond=plan");
  await expect(page.getByRole("button", { name: /Fond et calques\s*Plan/ })).toBeVisible();
  await expect(page.locator("svg image")).toHaveAttribute("href", /\/data\/fonds\/plan-france\.jpg/);
});

test("l'ancien fond satellite d'une adresse partagée revient au relief", async ({ page }) => {
  await offline(page);
  await page.goto("/carte?annee=2026&rendu=2d&fond=satellite");
  await expect(page.getByRole("button", { name: /Fond et calques\s*Relief/ })).toBeVisible();
  await expect(page.locator("svg image")).toHaveCount(0);
});
