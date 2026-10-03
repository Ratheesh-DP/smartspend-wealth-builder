// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, getLovableAiGatewayResponseHeaders } from "../_shared/run-id.ts";

const KITE_API = "https://api.kite.trade";
const NIFTY_100_CSV = "https://www.niftyindices.com/IndexConstituent/ind_nifty100list.csv";
const MAX_LOOKBACK = 365;
const MAX_STOCKS = 100;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Secure session storage is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

function sha256(value: string) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then((buffer) =>
    Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === "," && !quoted) { row.push(cell.trim()); cell = ""; continue; }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = ""; continue;
    }
    cell += character;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

function keyedRows(text: string) {
  const rows = csvRows(text);
  const headers = (rows.shift() ?? []).map((header) => header.toLowerCase().replace(/[^a-z0-9]/g, ""));
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function cleanText(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 255);
}

function profileData(data: any) {
  const profile = data?.data ?? data ?? {};
  return {
    userName: cleanText(profile.user_name || profile.userName, "Kite user"),
    userId: cleanText(profile.user_id || profile.userId),
    email: cleanText(profile.email),
    products: Array.isArray(profile.products) ? profile.products : [],
    exchanges: Array.isArray(profile.exchanges) ? profile.exchanges : [],
    broker: cleanText(profile.broker, "Zerodha"),
  };
}

async function kiteRequest(path: string, apiKey: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(`${KITE_API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `token ${apiKey}:${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.status === "error") {
    const error = new Error(body?.message || "Kite Connect request failed");
    error.status = response.status || 502;
    throw error;
  }
  return body;
}

async function findSession(apiKey: string) {
  const { data, error } = await adminClient().from("kite_sessions").select("*").eq("client_id", apiKey).maybeSingle();
  if (error) throw new Error("Could not read the saved Kite session");
  if (!data) throw Object.assign(new Error("No saved Kite session. Log in again."), { status: 401 });
  return data;
}

async function login(apiKey: string, apiSecret: string, requestToken: string) {
  const checksum = await sha256(`${apiKey}${requestToken}${apiSecret}`);
  const form = new URLSearchParams({ api_key: apiKey, request_token: requestToken, checksum });
  const response = await fetch(`${KITE_API}/session/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.status === "error" || !body?.data?.access_token) {
    const error = new Error(body?.message || "Kite rejected the login details");
    error.status = response.status || 401;
    throw error;
  }
  const session = body.data;
  const expiresAt = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
  const { error } = await adminClient().from("kite_sessions").upsert({
    client_id: apiKey,
    api_key: apiKey,
    access_token: session.access_token,
    user_id: session.user_id ?? null,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }, { onConflict: "client_id" });
  if (error) throw new Error("Login succeeded but the secure session could not be saved");
  return profileData(session);
}

async function currentProfile(apiKey: string) {
  const session = await findSession(apiKey);
  const response = await kiteRequest("/user/profile", apiKey, session.access_token);
  return profileData(response);
}

function dateOnly(date: Date) { return date.toISOString().slice(0, 10); }

function sma(values: number[], end: number, length: number) {
  if (end - length + 1 < 0) return null;
  const slice = values.slice(end - length + 1, end + 1);
  return slice.reduce((sum, value) => sum + value, 0) / length;
}

async function generateSignals(apiKey: string, params: { short: number; long: number; lookback: number; maxStocks: number }) {
  const session = await findSession(apiKey);
  const [constituentsResponse, instrumentsResponse] = await Promise.all([
    fetch(NIFTY_100_CSV, { headers: { "User-Agent": "Mozilla/5.0" } }),
    kiteRequest("/instruments/NSE", apiKey, session.access_token),
  ]);
  if (!constituentsResponse.ok) throw new Error("The official Nifty 100 constituent list could not be loaded");
  const constituentRows = keyedRows(await constituentsResponse.text());
  const instrumentRows = keyedRows(await instrumentsResponse.text());
  const instruments = new Map(instrumentRows.filter((row) => row.tradingsymbol).map((row) => [row.tradingsymbol, row]));
  const stocks = constituentRows.map((row) => ({
    ticker: cleanText(row.symbol || row.tradingsymbol),
    company: cleanText(row.companyname || row.company || row.name, cleanText(row.symbol)),
  })).filter((stock) => stock.ticker && instruments.has(stock.ticker)).slice(0, params.maxStocks);

  const from = new Date(Date.now() - (params.lookback + params.long + 30) * 2 * 24 * 60 * 60 * 1000);
  const to = new Date();
  const results: any[] = [];
  for (let start = 0; start < stocks.length; start += 4) {
    const batch = stocks.slice(start, start + 4);
    const batchResults = await Promise.all(batch.map(async (stock) => {
      const instrument = instruments.get(stock.ticker);
      try {
        const body = await kiteRequest(`/instruments/historical/${instrument.instrument_token}/day?from=${dateOnly(from)}&to=${dateOnly(to)}`, apiKey, session.access_token);
        const candles = Array.isArray(body?.data?.candles) ? body.data.candles : [];
        const closes = candles.map((c) => Number(c[4])).filter(Number.isFinite);
        let latest: any = null;
        for (let index = params.long; index < candles.length; index += 1) {
          const previousShort = sma(closes, index - 1, params.short);
          const previousLong = sma(closes, index - 1, params.long);
          const currentShort = sma(closes, index, params.short);
          const currentLong = sma(closes, index, params.long);
          if ([previousShort, previousLong, currentShort, currentLong].some((value) => value === null)) continue;
          const bullish = previousShort <= previousLong && currentShort > currentLong;
          const bearish = previousShort >= previousLong && currentShort < currentLong;
          if (bullish || bearish) {
            const crossoverDate = dateOnly(new Date(candles[index][0]));
            const age = (Date.now() - new Date(crossoverDate).getTime()) / (24 * 60 * 60 * 1000);
            if (age <= params.lookback) latest = {
              ticker: stock.ticker,
              company: stock.company,
              type: bullish ? "Bullish" : "Bearish",
              date: crossoverDate,
              close: closes[index],
              shortSma: currentShort,
              longSma: currentLong,
            };
          }
        }
        return latest;
      } catch (error) {
        console.error(`Signal scan failed for ${stock.ticker}:`, error?.message || error);
        return null;
      }
    }));
    results.push(...batchResults.filter(Boolean));
  }
  results.sort((a, b) => b.date.localeCompare(a.date));
  return { signals: results, scanned: stocks.length, source: "Nifty 100" };
}

async function getCandles(apiKey: string, tickerValue: unknown, shortValue: unknown, longValue: unknown, lookbackValue: unknown) {
  const ticker = cleanText(tickerValue).toUpperCase();
  if (!/^[A-Z0-9&-]{1,30}$/.test(ticker)) throw Object.assign(new Error("Enter a valid NSE ticker"), { status: 400 });
  const short = Math.min(Math.max(Number(shortValue) || 6, 2), 50);
  const long = Math.min(Math.max(Number(longValue) || 30, short + 1), 200);
  const lookback = Math.min(Math.max(Number(lookbackValue) || 180, 60), 365);
  const session = await findSession(apiKey);
  const instrumentResponse = await kiteRequest("/instruments/NSE", apiKey, session.access_token);
  const instrument = keyedRows(instrumentResponse).find((row) => row.tradingsymbol?.toUpperCase() === ticker);
  if (!instrument?.instrument_token) throw Object.assign(new Error(`NSE instrument ${ticker} was not found`), { status: 404 });
  const to = new Date();
  const from = new Date(Date.now() - (lookback + long + 20) * 2 * 86400000);
  const response = await kiteRequest(`/instruments/historical/${instrument.instrument_token}/day?from=${dateOnly(from)}&to=${dateOnly(to)}`, apiKey, session.access_token);
  const raw = Array.isArray(response?.data?.candles) ? response.data.candles.slice(-lookback) : [];
  const candles = raw.map((candle) => ({
    date: dateOnly(new Date(candle[0])), open: Number(candle[1]), high: Number(candle[2]),
    low: Number(candle[3]), close: Number(candle[4]), volume: Number(candle[5]),
  })).filter((candle) => Number.isFinite(candle.close));
  const crossovers: Array<{ date: string; type: string }> = [];
  const closes = candles.map((item) => item.close);
  candles.forEach((candle, index) => {
    const previousShort = sma(closes, index - 1, short);
    const previousLong = sma(closes, index - 1, long);
    const currentShort = sma(closes, index, short);
    const currentLong = sma(closes, index, long);
    if ([previousShort, previousLong, currentShort, currentLong].some((value) => value === null)) return;
    if (previousShort <= previousLong && currentShort > currentLong) crossovers.push({ date: candle.date, type: "Bullish" });
    if (previousShort >= previousLong && currentShort < currentLong) crossovers.push({ date: candle.date, type: "Bearish" });
    candle["shortSma"] = currentShort;
    candle["longSma"] = currentLong;
  });
  return { ticker, candles, crossovers, short, long };
}

async function explainTrend(req: Request, body: any) {
  const ticker = cleanText(body?.ticker).toUpperCase();
  const signal = cleanText(body?.signal);
  const candles = Array.isArray(body?.candles) ? body.candles.slice(-60) : [];
  if (!/^[A-Z0-9&-]{1,30}$/.test(ticker) || !["Bullish", "Bearish", "No recent crossover"].includes(signal) || candles.length < 3)
    throw Object.assign(new Error("Provide a valid ticker, crossover signal, and at least three daily candles"), { status: 400 });
  const normalized = candles.map((row: any) => ({
    date: cleanText(row?.date), open: Number(row?.open), high: Number(row?.high), low: Number(row?.low), close: Number(row?.close),
    shortSma: Number(row?.shortSma), longSma: Number(row?.longSma),
  }));
  if (normalized.some((row: any) => !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || ![row.open, row.high, row.low, row.close].every(Number.isFinite)))
    throw Object.assign(new Error("Candle data has invalid dates or prices"), { status: 400 });
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw Object.assign(new Error("AI analysis is not configured"), { status: 500 });
  const gateway = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
  const upstream = await gateway.fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST", signal: req.signal,
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra", stream: true, store: false,
      reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
      input: [
        { role: "system", content: [{ type: "input_text", text: "Explain technical trend context from user-supplied Indian stock daily candles. Be concise and neutral. Mention momentum, SMA context, volatility or limitations, and plausible risks. Do not recommend buying/selling or predict returns. Treat the data as historical and not investment advice." }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify({ ticker, crossoverSignal: signal, candles: normalized }) }] },
      ],
    }),
  });
  const headers = getLovableAiGatewayResponseHeaders(upstream.headers, { ...corsHeaders, "Content-Type": "application/json" });
  if (!upstream.ok) {
    const detail = await upstream.text();
    return new Response(JSON.stringify({ error: detail || `AI Gateway returned ${upstream.status}` }), { status: upstream.status, headers });
  }
  if (!upstream.body) return new Response(JSON.stringify({ error: "AI Gateway returned an empty stream" }), { status: 502, headers });
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const data = event.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "response.output_text.delta") answer += parsed.delta ?? "";
      } catch { /* Ignore SSE keep-alive frames. */ }
    }
  }
  return new Response(JSON.stringify({ analysis: answer.trim() || "No analysis text was returned." }), { headers });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const action = cleanText(body?.action);
    const apiKey = cleanText(body?.apiKey);
    if (!apiKey || apiKey.length > 100) return jsonResponse({ error: "Enter a valid Kite API key" }, 400);
    if (action === "login") {
      const apiSecret = cleanText(body?.apiSecret);
      const requestToken = cleanText(body?.requestToken);
      if (!apiSecret || !requestToken) return jsonResponse({ error: "API secret and request token are required" }, 400);
      return jsonResponse({ connected: true, profile: await login(apiKey, apiSecret, requestToken) });
    }
    if (action === "logout") {
      await adminClient().from("kite_sessions").delete().eq("client_id", apiKey);
      return jsonResponse({ connected: false });
    }
    if (action === "profile") return jsonResponse({ connected: true, profile: await currentProfile(apiKey) });
    if (action === "signals") {
      const short = Math.min(Math.max(Number(body?.short) || 6, 2), 50);
      const long = Math.min(Math.max(Number(body?.long) || 30, short + 1), 200);
      const lookback = Math.min(Math.max(Number(body?.lookback) || 60, 1), MAX_LOOKBACK);
      const maxStocks = Math.min(Math.max(Number(body?.maxStocks) || 25, 1), MAX_STOCKS);
      return jsonResponse(await generateSignals(apiKey, { short, long, lookback, maxStocks }));
    }
    if (action === "candles") return jsonResponse(await getCandles(apiKey, body?.ticker, body?.short, body?.long, body?.lookback));
    if (action === "explain") return await explainTrend(req, body);
    return jsonResponse({ error: "Unknown Kite action" }, 400);
  } catch (error) {
    const status = Math.min(Math.max(Number(error?.status) || 500, 400), 599);
    if (status >= 500) console.error("kite function error:", error?.message || error);
    return jsonResponse({ error: error?.message || "Kite Connect request failed" }, status);
  }
});