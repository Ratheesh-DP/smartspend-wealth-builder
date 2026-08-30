import { Page } from "@playwright/test";

export interface MockTransaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  user_id: string;
}

export const sampleTransactions: MockTransaction[] = [
  {
    id: "tx-1",
    description: "Monthly Salary",
    amount: 75000,
    type: "income",
    category: "Salary",
    date: "2026-08-01",
    user_id: "guest",
  },
  {
    id: "tx-2",
    description: "Rent",
    amount: -22000,
    type: "expense",
    category: "Housing",
    date: "2026-08-02",
    user_id: "guest",
  },
  {
    id: "tx-3",
    description: "Swiggy Order",
    amount: -650,
    type: "expense",
    category: "Food",
    date: "2026-08-05",
    user_id: "guest",
  },
  {
    id: "tx-4",
    description: "Freelance Payment",
    amount: 15000,
    type: "income",
    category: "Freelance",
    date: "2026-08-10",
    user_id: "guest",
  },
  {
    id: "tx-5",
    description: "Petrol",
    amount: -1200,
    type: "expense",
    category: "Transport",
    date: "2026-08-12",
    user_id: "guest",
  },
];

let storedTransactions = [...sampleTransactions];

export function resetMockTransactions() {
  storedTransactions = [...sampleTransactions];
}

export async function mockSupabase(page: Page) {
  resetMockTransactions();

  await page.route("**/rest/v1/**", async (route, request) => {
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.includes("/transactions") && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "content-range": `0-${storedTransactions.length - 1}/${storedTransactions.length}` },
        body: JSON.stringify(storedTransactions),
      });
    }

    if (url.pathname.includes("/transactions") && method === "POST") {
      const body = await request.postDataJSON();
      const inserted = Array.isArray(body) ? body : [body];
      const newTxs = inserted.map((tx) => ({
        ...tx,
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }));
      storedTransactions.push(...newTxs);
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(newTxs),
      });
    }

    if (url.pathname.includes("/transactions") && method === "DELETE") {
      const idMatch = url.searchParams.get("id")?.replace("eq.", "");
      if (idMatch) {
        storedTransactions = storedTransactions.filter((t) => t.id !== idMatch);
      }
      return route.fulfill({ status: 204 });
    }

    return route.continue();
  });
}
