import { expect, test, type Page } from "@playwright/test";

// Imagery requests are answered locally: the tests do not depend on the IGN service.
const offline = (page: Page) =>
  page.route("https://data.geopf.fr/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: Buffer.alloc(0) }));

test("le fond de carte se choisit et se partage dans l'adresse", async ({ page }) => {
  await offline(page);
  await page.goto("/?year=2026&rendu=2d");
  await page.getByRole("button", { name: /Fond de carte\s*Relief/ }).click();
  const picker = page.getByRole("radiogroup", { name: "Fond de carte" });
  await expect(picker.getByRole("radio", { name: "Relief" })).toHaveAttribute("aria-checked", "true");
  await picker.getByRole("radio", { name: "Satellite" }).click();
  await expect(picker.getByRole("radio", { name: "Satellite" })).toHaveAttribute("aria-checked", "true");
  await expect(page).toHaveURL(/fond=satellite/);
  // Its source in the attribution, and the image itself in the 2D map.
  await expect(page.getByText(/IGN \/ CNES/).first()).toBeVisible();
  await expect(page.locator("svg image")).toHaveAttribute("href", /ORTHO-SAT\.SPOT\.2025/);
  await picker.getByRole("radio", { name: "Relief" }).click();
  await expect(page).not.toHaveURL(/fond=/);
  await expect(page.locator("svg image")).toHaveCount(0);
});

test("un fond passé dans l'adresse est appliqué", async ({ page }) => {
  await offline(page);
  await page.goto("/?year=2026&rendu=2d&fond=plan");
  await expect(page.getByRole("button", { name: /Fond de carte\s*Plan/ })).toBeVisible();
  await expect(page.locator("svg image")).toHaveAttribute("href", /PLANIGNV2/);
});
