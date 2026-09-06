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

export interface TransactionLoadResult {
  transactions: Transaction[];
  source: "google-sheets" | "local" | "empty";
  warning?: string;
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

export async function loadTransactions(): Promise<TransactionLoadResult> {
  const localTransactions = readLocalTransactions();
  const { data, error } = await supabase.functions.invoke("sheets-transactions");

  if (error) {
    return {
      transactions: localTransactions,
      source: localTransactions.length > 0 ? "local" : "empty",
      warning: "Google Sheets access is unavailable. Share the spreadsheet with the connected Google account, then refresh.",
    };
  }

  const sheetTransactions = Array.isArray(data?.transactions) ? data.transactions as Transaction[] : [];
  return {
    transactions: [...sheetTransactions, ...localTransactions],
    source: sheetTransactions.length > 0 ? "google-sheets" : localTransactions.length > 0 ? "local" : "empty",
  };
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