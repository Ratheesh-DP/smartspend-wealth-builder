import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadTransactions } from "@/lib/transactions";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const invoke = vi.mocked(supabase.functions.invoke);

describe("transaction feed freshness", () => {
  beforeEach(() => {
    localStorage.clear();
    invoke.mockReset();
  });

  it("records the last successful Sheets read and reports source counts", async () => {
    invoke.mockResolvedValue({
      data: { transactions: [{ id: "sheet-1", description: "Sheet row", amount: -20, type: "expense", category: "Food", date: "2026-08-01" }] },
      error: null,
    } as never);
    localStorage.setItem("smartspend_imported_transactions", JSON.stringify([
      { id: "csv-1", description: "Local row", amount: -5, type: "expense", category: "Food", date: "2026-08-02", source: "csv" },
    ]));

    const result = await loadTransactions();

    expect(result.sheetCount).toBe(1);
    expect(result.localCount).toBe(1);
    expect(result.source).toBe("google-sheets");
    expect(result.lastSuccessfulSheetsReadAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(localStorage.getItem("smartspend_last_successful_sheets_read")).toBe(result.lastSuccessfulSheetsReadAt);
  });

  it("keeps the last successful read time when Sheets becomes unavailable", async () => {
    const previousRead = "2026-08-15T10:30:00.000Z";
    localStorage.setItem("smartspend_last_successful_sheets_read", previousRead);
    invoke.mockResolvedValue({ data: null, error: { context: { status: 403 } } } as never);

    const result = await loadTransactions();

    expect(result.source).toBe("empty");
    expect(result.warning).toContain("denied access");
    expect(result.lastSuccessfulSheetsReadAt).toBe(previousRead);
  });
});