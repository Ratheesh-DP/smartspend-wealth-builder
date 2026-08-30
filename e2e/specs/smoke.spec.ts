import { test, expect } from "@playwright/test";
import { mockSupabase } from "../helpers/supabase-mock";

test.describe("Smoke tests", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
  });

  test("app loads without login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SmartSpend|Vite|React/i);
    await expect(page.getByText("Finance Overview")).toBeVisible();
  });

  test("sidebar navigation works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /transactions/i }).click();
    await expect(page).toHaveURL("/transactions");
    await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();

    await page.getByRole("link", { name: /insights/i }).click();
    await expect(page).toHaveURL("/insights");
    await expect(page.getByRole("heading", { name: /insights/i })).toBeVisible();
  });
});
