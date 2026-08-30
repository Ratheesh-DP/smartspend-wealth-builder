import { test, expect } from "@playwright/test";
import { mockSupabase } from "../helpers/supabase-mock";

test.describe("Preferences", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto("/");
  });

  test("toggles privacy mode and masks amounts", async ({ page }) => {
    await expect(page.getByText(/₹[\d,]+\.\d{2}/)).toHaveCount(3);

    await page.getByRole("button", { name: /toggle privacy mode|hide amounts/i }).click();

    await expect(page.getByText("₹ ••••••").first()).toBeVisible();
  });

  test("toggles viewer/admin role and hides add button", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page.getByRole("button", { name: /add/i })).toBeVisible();

    await page.getByRole("button", { name: /admin/i }).click();
    await expect(page.getByText("Viewer mode")).toBeVisible();
    await expect(page.getByRole("button", { name: /add/i })).not.toBeVisible();
  });
});
