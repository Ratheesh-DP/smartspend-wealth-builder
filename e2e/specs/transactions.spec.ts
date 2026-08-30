import { test, expect } from "@playwright/test";
import { mockSupabase, sampleTransactions } from "../helpers/supabase-mock";

test.describe("Transactions page", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto("/transactions");
  });

  test("lists all transactions", async ({ page }) => {
    for (const tx of sampleTransactions) {
      await expect(page.getByText(tx.description)).toBeVisible();
    }
  });

  test("filters transactions by search", async ({ page }) => {
    await page.getByPlaceholder("Search...").fill("Swiggy");
    await expect(page.getByText("Swiggy Order")).toBeVisible();
    await expect(page.getByText("Monthly Salary")).not.toBeVisible();
  });

  test("filters transactions by type", async ({ page }) => {
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Income" }).click();
    await expect(page.getByText("Monthly Salary")).toBeVisible();
    await expect(page.getByText("Rent")).not.toBeVisible();
  });

  test("adds a new transaction", async ({ page }) => {
    await page.getByRole("button", { name: /add/i }).click();
    await page.getByRole("combobox").filter({ hasText: /expense|income/i }).first().click();
    await page.getByRole("option", { name: "Expense" }).click();
    await page.locator("button:has-text('Select')").first().click();
    await page.getByRole("option", { name: "Food" }).click();
    await page.getByPlaceholder("e.g. Swiggy Order").fill("Test Expense");
    await page.locator("input[type='number']").fill("500");
    await page.getByRole("button", { name: /add transaction/i }).click();

    await expect(page.getByText("Test Expense")).toBeVisible();
    await expect(page.getByText("₹500.00")).toBeVisible();
  });
});
