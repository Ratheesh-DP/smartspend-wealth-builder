// @ts-nocheck

export const SPREADSHEET_ID = "1sFHZW-C4p80FgsWHsebEnnWhbM9XyuB-FdV9KQmTWIo";
const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev/google_sheets";

function gatewayHeaders() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const sheetsKey = Deno.env.get("GOOGLE_SHEETS_API_KEY");
  if (!lovableKey || !sheetsKey) throw new Error("Google Sheets connection is not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": sheetsKey,
    Accept: "application/json",
  };
}

export async function sheetsRequest(path: string) {
  const response = await fetch(`${GATEWAY_BASE_URL}${path}`, { headers: gatewayHeaders() });
  if (!response.ok) {
    const details = await response.text();
    console.error(`Google Sheets request failed [${response.status}]: ${details}`);
    throw Object.assign(new Error(details || "Google Sheets request failed"), {
      status: response.status,
      details,
    });
  }
  return response.json();
}

export function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findColumn(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.some((name) => header === name || header.includes(name)));
}

function parseAmount(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const negative = raw.startsWith("-") || (raw.startsWith("(") && raw.endsWith(")"));
  const parsed = Number(raw.replace(/[₹,$,\s()]/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function parseDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) return raw;

  const parts = raw.split(/[/.\-]/).map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [first, second, third] = parts;
    if (first > 31) return `${first.toString().padStart(4, "0")}-${second.toString().padStart(2, "0")}-${third.toString().padStart(2, "0")}`;
    const day = first > 12 ? first : second;
    const month = first > 12 ? second : first;
    const year = third < 100 ? 2000 + third : third;
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  }

  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? new Date().toISOString().slice(0, 10) : new Date(timestamp).toISOString().slice(0, 10);
}

export function rowsToTransactions(values: unknown[][]) {
  if (!Array.isArray(values) || values.length < 2) return [];
  const headers = (values[0] ?? []).map(normalizeHeader);
  const dateIndex = findColumn(headers, ["date", "transaction date", "txn date", "value date"]);
  const descriptionIndex = findColumn(headers, ["description", "narration", "particulars", "details", "remarks", "merchant"]);
  const amountIndex = findColumn(headers, ["amount", "transaction amount", "value"]);
  const debitIndex = findColumn(headers, ["debit", "withdrawal", "dr"]);
  const creditIndex = findColumn(headers, ["credit", "deposit", "cr"]);
  const categoryIndex = findColumn(headers, ["category", "expense category"]);
  const typeIndex = findColumn(headers, ["type", "transaction type", "dr cr"]);

  return values.slice(1).map((row, rowIndex) => {
    const debit = debitIndex >= 0 ? parseAmount(row[debitIndex]) : null;
    const credit = creditIndex >= 0 ? parseAmount(row[creditIndex]) : null;
    let amount = amountIndex >= 0 ? parseAmount(row[amountIndex]) : null;
    if (amount === null && debit !== null) amount = -Math.abs(debit);
    if (amount === null && credit !== null) amount = Math.abs(credit);
    if (amount === null) return null;

    const explicitType = String(typeIndex >= 0 ? row[typeIndex] ?? "" : "").toLowerCase();
    const isIncome = explicitType.includes("income") || explicitType.includes("credit") || explicitType === "cr" || (amount > 0 && debit === null);
    const signedAmount = isIncome ? Math.abs(amount) : -Math.abs(amount);
    return {
      id: `sheet-${rowIndex + 2}`,
      description: String(descriptionIndex >= 0 ? row[descriptionIndex] ?? "Imported transaction" : "Imported transaction").trim() || "Imported transaction",
      amount: signedAmount,
      type: isIncome ? "income" : "expense",
      category: String(categoryIndex >= 0 ? row[categoryIndex] ?? "Other" : "Other").trim() || "Other",
      date: parseDate(dateIndex >= 0 ? row[dateIndex] : undefined),
      source: "sheets",
    };
  }).filter(Boolean);
}

export async function loadSheetTransactions() {
  const metadata = await sheetsRequest(`/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`);
  const title = metadata?.sheets?.[0]?.properties?.title;
  if (!title) throw Object.assign(new Error("The spreadsheet has no readable sheets"), { status: 422 });

  const range = `'${String(title).replaceAll("'", "''")}'!A1:Z1000`;
  const params = new URLSearchParams({ ranges: range, majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
  const result = await sheetsRequest(`/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${params.toString()}`);
  const values = result?.valueRanges?.[0]?.values ?? [];
  return { sheetTitle: title, transactions: rowsToTransactions(values) };
}