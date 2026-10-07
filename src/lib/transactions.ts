import { supabase } from "@/integrations/supabase/client";

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  source?: "sheets" | "ocr" | "manual" | "csv";
  reconciliationStatus?: "matched" | "amount-mismatch" | "date-mismatch" | "duplicate" | "unmatched";
  reconciliationReason?: string;
  comparedTransactionId?: string;
  reviewed?: boolean;
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
  try {
    const { data, error } = await supabase.functions.invoke("sheets-transactions");
    if (error) {
      const status = Number((error as { context?: { status?: number } }).context?.status);
      return {
        transactions: localTransactions,
        source: localTransactions.length > 0 ? "local" : "empty",
        warning: status === 403
          ? "Google Sheets denied access to the connected account. Share the spreadsheet with that account as a Viewer, then recheck access."
          : "Google Sheets could not be read. Locally imported transactions remain available; recheck access to try again.",
      };
    }

    const accessStatus = Number(data?.accessError?.status);
    if (accessStatus) {
      return {
        transactions: localTransactions,
        source: localTransactions.length > 0 ? "local" : "empty",
        warning: accessStatus === 404
          ? "Google Sheets could not find the spreadsheet for the connected account. Check the link and sharing, then recheck access."
          : "Google Sheets denied access to the connected account. Share the spreadsheet with that account as a Viewer, then recheck access.",
      };
    }

    const sheetTransactions = Array.isArray(data?.transactions) ? data.transactions as Transaction[] : [];
    return {
      transactions: [...sheetTransactions, ...localTransactions],
      source: sheetTransactions.length > 0 ? "google-sheets" : localTransactions.length > 0 ? "local" : "empty",
    };
  } catch {
    return {
      transactions: localTransactions,
      source: localTransactions.length > 0 ? "local" : "empty",
      warning: "Google Sheets could not be reached. Locally imported transactions remain available; recheck access to try again.",
    };
  }
}

export function addLocalTransactions(rows: Transaction[]) {
  const existing = readLocalTransactions();
  const knownIds = new Set(existing.map((row) => row.id));
  writeLocalTransactions([...rows.filter((row) => !knownIds.has(row.id)), ...existing]);
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