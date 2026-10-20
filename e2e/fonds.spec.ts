import { expect, test } from "@playwright/test";

test("le fond de carte se choisit et se partage dans l'adresse", async ({ page }) => {
  // Imagery requests are answered locally: the test does not depend on the IGN service.
  await page.route("https://data.geopf.fr/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: Buffer.alloc(0) }));
  await page.goto("/explorer?year=2026&rendu=2d");
  const group = page.getByRole("group", { name: "Fond de carte" });
  await expect(group.getByRole("button", { name: "Relief" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "Satellite" }).click();
  await expect(group.getByRole("button", { name: "Satellite" })).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/fond=satellite/);
  // Source of the imagery, and the image itself in the 2D map.
  await expect(page.getByText("IGN / CNES")).toBeVisible();
  await expect(page.locator("svg image")).toHaveAttribute("href", /ORTHO-SAT\.SPOT\.2025/);
  await group.getByRole("button", { name: "Relief" }).click();
  await expect(page).not.toHaveURL(/fond=/);
  await expect(page.locator("svg image")).toHaveCount(0);
});

test("un fond passé dans l'adresse est appliqué", async ({ page }) => {
  await page.route("https://data.geopf.fr/**", (route) => route.fulfill({ status: 200, contentType: "image/jpeg", body: Buffer.alloc(0) }));
  await page.goto("/explorer?year=2026&rendu=2d&fond=plan");
  await expect(page.getByRole("group", { name: "Fond de carte" }).getByRole("button", { name: "Plan" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("svg image")).toHaveAttribute("href", /PLANIGNV2/);
});
