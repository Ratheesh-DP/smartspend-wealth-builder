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
  sheetCount: number;
  localCount: number;
  lastSuccessfulSheetsReadAt: string | null;
}

const LOCAL_TRANSACTIONS_KEY = "smartspend_imported_transactions";
const LAST_SHEETS_READ_KEY = "smartspend_last_successful_sheets_read";

function getLastSuccessfulSheetsReadAt() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_SHEETS_READ_KEY);
  } catch {
    return null;
  }
}

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
  const fallback = (warning: string): TransactionLoadResult => ({
    transactions: localTransactions,
    source: localTransactions.length > 0 ? "local" : "empty",
    warning,
    sheetCount: 0,
    localCount: localTransactions.length,
    lastSuccessfulSheetsReadAt: getLastSuccessfulSheetsReadAt(),
  });

  try {
    const { data, error } = await supabase.functions.invoke("sheets-transactions");
    if (error) {
      const status = Number((error as { context?: { status?: number } }).context?.status);
      return fallback(status === 403
          ? "Google Sheets denied access to the connected account. Share the spreadsheet with that account as a Viewer, then recheck access."
          : "Google Sheets could not be read. Locally imported transactions remain available; recheck access to try again.");
    }

    const accessStatus = Number(data?.accessError?.status);
    if (accessStatus) {
      return fallback(accessStatus === 404
          ? "Google Sheets could not find the spreadsheet for the connected account. Check the link and sharing, then recheck access."
          : "Google Sheets denied access to the connected account. Share the spreadsheet with that account as a Viewer, then recheck access.");
    }

    const sheetTransactions = Array.isArray(data?.transactions) ? data.transactions as Transaction[] : [];
    const lastSuccessfulSheetsReadAt = new Date().toISOString();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(LAST_SHEETS_READ_KEY, lastSuccessfulSheetsReadAt);
      } catch {
        // Keep feed loading available when browser storage is disabled.
      }
    }
    return {
      transactions: [...sheetTransactions, ...localTransactions],
      source: sheetTransactions.length > 0 ? "google-sheets" : localTransactions.length > 0 ? "local" : "empty",
      sheetCount: sheetTransactions.length,
      localCount: localTransactions.length,
      lastSuccessfulSheetsReadAt,
    };
  } catch {
    return fallback("Google Sheets could not be reached. Locally imported transactions remain available; recheck access to try again.");
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