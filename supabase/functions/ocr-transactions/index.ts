// @ts-nocheck
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_FILE_CHARS = 16 * 1024 * 1024;
const MODEL = "google/gemini-3.6-flash";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function responseText(body: any) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  return Array.isArray(content) ? content.map((part) => part?.text ?? "").join(" ") : "";
}

function parseJson(text: string) {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("OCR returned an unreadable result");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeRows(payload: any) {
  const rows = Array.isArray(payload?.transactions) ? payload.transactions : [];
  return rows.map((row: any, index: number) => {
    const amount = Number(row?.amount);
    if (!Number.isFinite(amount)) return null;
    const type = String(row?.type ?? "").toLowerCase().includes("income") ? "income" : amount >= 0 ? "income" : "expense";
    return {
      id: `ocr-${Date.now()}-${index}`,
      description: String(row?.description || "Bank statement transaction").slice(0, 255),
      amount: type === "income" ? Math.abs(amount) : -Math.abs(amount),
      type,
      category: String(row?.category || "Other").slice(0, 80),
      date: /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date)) ? row.date : new Date().toISOString().slice(0, 10),
      source: "ocr",
    };
  }).filter(Boolean).slice(0, 1000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const fileName = typeof body?.fileName === "string" ? body.fileName.slice(0, 180) : "statement";
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "";
    const dataUrl = typeof body?.dataUrl === "string" ? body.dataUrl : "";
    if (!dataUrl || !/^data:(image\/|application\/pdf)/i.test(dataUrl) || dataUrl.length > MAX_FILE_CHARS) {
      return jsonResponse({ error: "Upload a PDF or image bank statement under 12 MB" }, 400);
    }

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return jsonResponse({ error: "OCR is not configured" }, 500);

    const isPdf = mimeType === "application/pdf" || dataUrl.startsWith("data:application/pdf");
    const content = [
      {
        type: "text",
        text: `Extract every transaction from this bank statement. Return ONLY valid JSON in this exact shape: {"transactions":[{"date":"YYYY-MM-DD","description":"string","amount":123.45,"type":"income|expense","category":"Food|Shopping|Travel|Bills|Entertainment|Education|Housing|Investment|Transport|Utilities|Health|Other"}]}. Use positive amounts for income and positive magnitudes for expenses; the app will apply the expense sign. Preserve the statement's dates and descriptions. Do not include balances, headers, fees without a transaction row, or commentary. Filename: ${fileName}`,
      },
      isPdf
        ? { type: "file", file: { filename: fileName, file_data: dataUrl } }
        : { type: "image_url", image_url: { url: dataUrl } },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: "You are a precise bank-statement OCR parser. Never guess missing transaction fields." },
          { role: "user", content },
        ],
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error(`OCR gateway failed [${response.status}]: ${details}`);
      return jsonResponse({ error: "OCR service failed", status: response.status, details }, response.status);
    }

    const parsed = parseJson(await response.json().then(responseText));
    const transactions = normalizeRows(parsed);
    if (transactions.length === 0) return jsonResponse({ error: "No readable transactions were found in that statement" }, 422);
    return jsonResponse({ transactions });
  } catch (error) {
    console.error("ocr-transactions error", error);
    return jsonResponse({ error: error?.message || "Unable to read that statement" }, 422);
  }
});