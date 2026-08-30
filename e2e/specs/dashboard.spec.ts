import { test, expect } from "@playwright/test";
import { mockSupabase, sampleTransactions } from "../helpers/supabase-mock";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockSupabase(page);
    await page.goto("/");
  });

  test("displays overview cards with correct totals", async ({ page }) => {
    const totalIncome = sampleTransactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalExpenses = sampleTransactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const balance = totalIncome - totalExpenses;

    await expect(page.getByText("Finance Overview")).toBeVisible();
    await expect(page.locator("text=Total Balance").first()).toBeVisible();
    await expect(page.locator("text=Total Income").first()).toBeVisible();
    await expect(page.locator("text=Total Expenses").first()).toBeVisible();

    await expect(page.getByText(`₹${balance.toLocaleString("en-IN")}`)).toBeVisible();
    await expect(page.getByText(`₹${totalIncome.toLocaleString("en-IN")}`)).toBeVisible();
    await expect(page.getByText(`₹${totalExpenses.toLocaleString("en-IN")}`)).toBeVisible();
  });

  test("shows recent transactions", async ({ page }) => {
    for (const tx of sampleTransactions.slice(0, 5)) {
      await expect(page.getByText(tx.description)).toBeVisible();
    }
  });

  test("renders category chart", async ({ page }) => {
    await expect(page.getByText("Expenses by Category")).toBeVisible();
    await expect(page.locator(".recharts-surface")).toHaveCount(2);
  });
});
