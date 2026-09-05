import { supabase } from "@/integrations/supabase/client";

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  source?: "sheets" | "ocr" | "manual" | "csv";
}

const LOCAL_TRANSACTIONS_KEY = "smartspend_imported_transactions";

function readLocalTransactions(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = JSON.parse(window.localStorage.getItem(LOCAL_TRANSACTIONS_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function writeLocalTransactions(transactions: Transaction[]) {
  window.localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export async function loadTransactions(): Promise<Transaction[]> {
  const localTransactions = readLocalTransactions();
  const { data, error } = await supabase.functions.invoke("sheets-transactions");

  if (error) {
    if (localTransactions.length > 0) return localTransactions;
    throw new Error("Google Sheets could not be read. Check that the connected Google account can open your spreadsheet.");
  }

  return [...(data?.transactions ?? []), ...localTransactions];
}

export function addLocalTransactions(rows: Transaction[]) {
  const existing = readLocalTransactions();
  writeLocalTransactions([...rows, ...existing]);
}

export function removeLocalTransaction(id: string) {
  writeLocalTransactions(readLocalTransactions().filter((transaction) => transaction.id !== id));
}

export function createLocalTransaction(transaction: Omit<Transaction, "id">): Transaction {
  const row = { ...transaction, id: `manual-${crypto.randomUUID()}` };
  addLocalTransactions([row]);
  return row;
}

export function isLocalTransaction(transaction: Transaction) {
  return transaction.source === "ocr" || transaction.source === "manual" || transaction.source === "csv";
}

export function clearImportedTransactions() {
  writeLocalTransactions([]);
}