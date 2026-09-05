// @ts-nocheck
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { loadSheetTransactions } from "../_shared/googleSheets.ts";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const result = await loadSheetTransactions();
    return jsonResponse({ source: "Google Sheets", sheetTitle: result.sheetTitle, transactions: result.transactions });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return jsonResponse({
      error: "Unable to read Google Sheets",
      status,
      details: error?.details || error?.message || "The connected spreadsheet could not be read.",
    }, status >= 400 && status < 600 ? status : 500);
  }
});