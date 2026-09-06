export interface Budget {
  id: string;
  category: string;
  amount: number;
  month: number;
  year: number;
}

const LOCAL_BUDGETS_KEY = "smartspend_budgets";

function readBudgets(): Budget[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(LOCAL_BUDGETS_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeBudgets(budgets: Budget[]) {
  window.localStorage.setItem(LOCAL_BUDGETS_KEY, JSON.stringify(budgets));
}

export function loadBudgets(month: number, year: number) {
  return readBudgets().filter((budget) => budget.month === month && budget.year === year);
}

export function saveBudget(category: string, amount: number, month: number, year: number) {
  const existing = readBudgets();
  const matching = existing.find(
    (budget) => budget.category === category && budget.month === month && budget.year === year,
  );
  const nextBudget: Budget = matching
    ? { ...matching, amount }
    : { id: `budget-${crypto.randomUUID()}`, category, amount, month, year };
  const next = matching
    ? existing.map((budget) => (budget.id === matching.id ? nextBudget : budget))
    : [nextBudget, ...existing];
  writeBudgets(next);
  return nextBudget;
}

export function removeBudget(id: string) {
  writeBudgets(readBudgets().filter((budget) => budget.id !== id));
}