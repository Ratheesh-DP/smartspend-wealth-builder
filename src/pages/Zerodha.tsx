import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
  CandlestickChart,
  BrainCircuit,
} from "lucide-react";
import { CartesianGrid, ComposedChart, Customized, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type Profile = {
  userName: string;
  userId: string;
  email?: string;
  products: string[];
  exchanges: string[];
  broker: string;
};

type Signal = {
  ticker: string;
  company: string;
  type: "Bullish" | "Bearish";
  date: string;
  close: number;
  shortSma: number;
  longSma: number;
};

type KiteResponse = {
  error?: string;
  profile?: Profile;
  connected?: boolean;
  signals?: Signal[];
  scanned?: number;
  source?: string;
  candles?: Candle[];
  crossovers?: Array<{ date: string; type: string }>;
  analysis?: string;
};

type Candle = { date: string; open: number; high: number; low: number; close: number; volume: number; shortSma?: number | null; longSma?: number | null };

const API_KEY_STORAGE = "smartspend_kite_api_key";

const formatNumber = (value: number) => value.toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatDate = (value: string) => new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
}).format(new Date(value));

const invokeKite = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("kite", { body });
  if (error) throw new Error(error.message || "Could not reach Kite Connect");
  const payload = data as KiteResponse | null;
  if (!payload || payload.error) throw new Error(payload?.error || "Kite Connect returned an empty response");
  return payload;
};

const Zerodha = () => {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) ?? "");
  const [apiSecret, setApiSecret] = useState("");
  const [requestToken, setRequestToken] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState("user");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [scanned, setScanned] = useState(0);
  const [shortSma, setShortSma] = useState("6");
  const [longSma, setLongSma] = useState("30");
  const [lookback, setLookback] = useState("60");
  const [maxStocks, setMaxStocks] = useState("25");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [selectedSignalType, setSelectedSignalType] = useState("No recent crossover");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [crossovers, setCrossovers] = useState<Array<{ date: string; type: string }>>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");

  const connected = Boolean(profile);

  useEffect(() => {
    if (!apiKey) return;
    let active = true;
    setBusy(true);
    invokeKite({ action: "profile", apiKey })
      .then((result) => {
        if (active) setProfile(result.profile ?? null);
      })
      .catch(() => {
        if (active) setProfile(null);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [apiKey]);

  const signalCounts = useMemo(() => ({
    bullish: signals.filter((signal) => signal.type === "Bullish").length,
    bearish: signals.filter((signal) => signal.type === "Bearish").length,
  }), [signals]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await invokeKite({ action: "login", apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), requestToken: requestToken.trim() });
      localStorage.setItem(API_KEY_STORAGE, apiKey.trim());
      setProfile(result.profile ?? null);
      setApiSecret("");
      setRequestToken("");
      setActiveTab("user");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Kite login failed");
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      if (apiKey) await invokeKite({ action: "logout", apiKey });
    } catch {
      // Clear the local session even if the remote cleanup is unavailable.
    } finally {
      localStorage.removeItem(API_KEY_STORAGE);
      setApiKey("");
      setProfile(null);
      setSignals([]);
      setBusy(false);
    }
  };

  const handleSignals = async () => {
    if (!apiKey) return;
    setBusy(true);
    setError("");
    try {
      const result = await invokeKite({
        action: "signals",
        apiKey,
        short: Number(shortSma),
        long: Number(longSma),
        lookback: Number(lookback),
        maxStocks: Number(maxStocks),
      });
      setSignals(result.signals ?? []);
      setScanned(result.scanned ?? 0);
      setSelectedTicker(result.signals?.[0]?.ticker ?? "");
      setSelectedSignalType(result.signals?.[0]?.type ?? "No recent crossover");
      setCandles([]);
      setAnalysis("");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Signal scan failed");
    } finally {
      setBusy(false);
    }
  };

  const loadTickerCandles = async (tickerValue: string) => {
    const ticker = tickerValue.trim().toUpperCase();
    if (!ticker || !apiKey) return null;
    setChartLoading(true);
    setError("");
    try {
      const result = await invokeKite({ action: "candles", apiKey, ticker, short: Number(shortSma), long: Number(longSma), lookback: 180 });
      setCandles(result.candles ?? []);
      setCrossovers(result.crossovers ?? []);
      setSelectedTicker(ticker);
      setAnalysis("");
      return result.candles ?? [];
    } catch (chartError) {
      setError(chartError instanceof Error ? chartError.message : "Could not load daily candles");
      return null;
    } finally {
      setChartLoading(false);
    }
  };

  const explainSelectedTrend = async () => {
    if (!selectedTicker.trim()) return;
    setAnalysisLoading(true);
    setError("");
    setAnalysis("");
    try {
      const recentCandles = candles.length ? candles : await loadTickerCandles(selectedTicker);
      if (!recentCandles || recentCandles.length < 3) throw new Error("Load at least three daily candles before requesting an explanation.");
      const result = await invokeKite({ action: "explain", apiKey, ticker: selectedTicker.trim().toUpperCase(), signal: selectedSignalType, candles: recentCandles.slice(-60) });
      setAnalysis(result.analysis ?? "No analysis was returned.");
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Could not analyze the trend");
    } finally {
      setAnalysisLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary">
            <BarChart3 className="h-4 w-4" />
            Zerodha market workspace
          </div>
          <h1 className="text-2xl font-display font-bold">Kite Connect, without the clutter</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Connect your Kite account once, review your profile, and scan the Nifty 100 for fresh SMA crossovers.
          </p>
        </div>
        {connected && (
          <Button variant="outline" onClick={handleLogout} disabled={busy} className="gap-2 self-start lg:self-auto">
            <LogOut className="h-4 w-4" />
            Disconnect
          </Button>
        )}
      </div>

      {!connected ? (
        <Card className="glass-card border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" />Connect to Kite Connect</CardTitle>
            <p className="text-sm text-muted-foreground">Use the request token generated by your Kite Connect login flow. It is exchanged securely and is not displayed or saved in the browser.</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">API key</span>
                <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Your Kite API key" autoComplete="off" required />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">API secret</span>
                <Input value={apiSecret} onChange={(event) => setApiSecret(event.target.value)} placeholder="Your Kite API secret" type="password" autoComplete="off" required />
              </label>
              <label className="space-y-2 text-sm">
                <span className="text-muted-foreground">Request token</span>
                <Input value={requestToken} onChange={(event) => setRequestToken(event.target.value)} placeholder="One-time request token" type="password" autoComplete="off" required />
              </label>
              <div className="md:col-span-3 flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">The saved session is reused during local development until Kite requires a new daily login.</p>
                <Button type="submit" disabled={busy} className="gap-2 glow-primary">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {busy ? "Connecting…" : "Login to Kite"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-muted/60 p-1 sm:w-fit">
            <TabsTrigger value="user" className="gap-2"><UserRound className="h-4 w-4" />User</TabsTrigger>
            <TabsTrigger value="signals" className="gap-2"><Activity className="h-4 w-4" />Signals</TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="glass-card md:col-span-2">
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Connected user</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Live profile details from Zerodha.</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div><p className="text-xs uppercase tracking-wider text-muted-foreground">User name</p><p className="mt-1 text-lg font-medium">{profile?.userName || "—"}</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-muted-foreground">User ID</p><p className="mt-1 font-mono text-sm">{profile?.userId || "—"}</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Broker</p><p className="mt-1 font-medium">{profile?.broker || "Zerodha"}</p></div>
                  <div><p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p><p className="mt-1 text-sm">{profile?.email || "Not supplied"}</p></div>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader><CardTitle className="text-base">Access scope</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div><p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Products</p><div className="flex flex-wrap gap-2">{profile?.products.length ? profile.products.map((item) => <Badge key={item} variant="secondary">{item}</Badge>) : <span className="text-sm text-muted-foreground">No products returned</span>}</div></div>
                  <div><p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Exchanges</p><div className="flex flex-wrap gap-2">{profile?.exchanges.length ? profile.exchanges.map((item) => <Badge key={item} variant="outline">{item}</Badge>) : <span className="text-sm text-muted-foreground">No exchanges returned</span>}</div></div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="signals" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div><CardTitle className="text-base">Nifty 100 SMA crossover scanner</CardTitle><p className="mt-1 text-sm text-muted-foreground">The official Nifty 100 list is mapped to NSE instruments and checked against daily candles.</p></div>
                  <Badge variant="outline" className="w-fit gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" />Server-side Kite session</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="space-y-2 text-sm"><span className="text-muted-foreground">Short SMA</span><Input type="number" min="2" max="50" value={shortSma} onChange={(event) => setShortSma(event.target.value)} /></label>
                  <label className="space-y-2 text-sm"><span className="text-muted-foreground">Long SMA</span><Input type="number" min="3" max="200" value={longSma} onChange={(event) => setLongSma(event.target.value)} /></label>
                  <label className="space-y-2 text-sm"><span className="text-muted-foreground">Lookback days</span><Input type="number" min="1" max="365" value={lookback} onChange={(event) => setLookback(event.target.value)} /></label>
                  <label className="space-y-2 text-sm"><span className="text-muted-foreground">Max stocks</span><Input type="number" min="1" max="100" value={maxStocks} onChange={(event) => setMaxStocks(event.target.value)} /></label>
                  <Button onClick={handleSignals} disabled={busy} className="self-end gap-2 sm:col-span-2 lg:col-span-1">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{busy ? "Scanning…" : "Generate signals"}</Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="glass-card"><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Signals found</p><p className="mt-2 text-2xl font-display font-bold">{signals.length}</p><p className="mt-1 text-xs text-muted-foreground">Across {scanned || "—"} mapped stocks</p></CardContent></Card>
              <Card className="glass-card border-primary/20"><CardContent className="pt-5"><p className="flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowUpRight className="h-4 w-4 text-primary" />Bullish</p><p className="mt-2 text-2xl font-display font-bold text-primary">{signalCounts.bullish}</p></CardContent></Card>
              <Card className="glass-card border-destructive/20"><CardContent className="pt-5"><p className="flex items-center gap-1.5 text-sm text-muted-foreground"><ArrowDownRight className="h-4 w-4 text-destructive" />Bearish</p><p className="mt-2 text-2xl font-display font-bold text-destructive">{signalCounts.bearish}</p></CardContent></Card>
            </div>

            <Card className="glass-card overflow-hidden">
              <CardHeader><CardTitle className="text-base">Latest crossovers</CardTitle></CardHeader>
              <CardContent className="p-0">
                {signals.length === 0 ? <div className="px-6 pb-8 pt-2 text-sm text-muted-foreground">Set your SMA parameters and generate a scan to see ranked crossovers.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-y border-border/60 bg-muted/20 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-6 py-3">Rank</th><th className="px-4 py-3">Ticker</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Crossover</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Close</th><th className="px-4 py-3 text-right">SMA {shortSma}</th><th className="px-6 py-3 text-right">SMA {longSma}</th></tr></thead><tbody>{signals.map((signal, index) => <tr key={`${signal.ticker}-${signal.date}`} onClick={() => { setSelectedTicker(signal.ticker); setSelectedSignalType(signal.type); void loadTickerCandles(signal.ticker); }} className={`cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/20 ${selectedTicker === signal.ticker ? "bg-muted/20" : ""}`}><td className="px-6 py-4 font-mono text-muted-foreground">{String(index + 1).padStart(2, "0")}</td><td className="px-4 py-4 font-display font-semibold">{signal.ticker}</td><td className="max-w-[220px] truncate px-4 py-4 text-muted-foreground">{signal.company}</td><td className="px-4 py-4"><Badge variant={signal.type === "Bullish" ? "default" : "destructive"}>{signal.type}</Badge></td><td className="px-4 py-4 text-muted-foreground">{formatDate(signal.date)}</td><td className="px-4 py-4 text-right font-mono">₹{formatNumber(signal.close)}</td><td className="px-4 py-4 text-right font-mono">{formatNumber(signal.shortSma)}</td><td className="px-6 py-4 text-right font-mono">{formatNumber(signal.longSma)}</td></tr>)}</tbody></table></div>}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CandlestickChart className="h-4 w-4 text-primary" />Daily price & SMA chart</CardTitle><p className="text-sm text-muted-foreground">Select a scan result or enter an NSE ticker to load historical daily prices.</p></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row"><Input aria-label="Chart ticker" value={selectedTicker} onChange={(event) => setSelectedTicker(event.target.value.toUpperCase())} placeholder="NSE ticker (e.g. RELIANCE)" className="sm:max-w-xs" /><Button variant="outline" onClick={() => void loadTickerCandles(selectedTicker)} disabled={chartLoading || !selectedTicker.trim()}>{chartLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Load chart</Button></div>
                {candles.length > 1 ? <div className="h-[320px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={candles} margin={{ top: 10, right: 10, left: 5, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="date" minTickGap={32} tickFormatter={(value) => value.slice(5)} stroke="hsl(var(--muted-foreground))" /><YAxis domain={["auto", "auto"]} width={72} tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} stroke="hsl(var(--muted-foreground))" /><Tooltip labelFormatter={(label) => formatDate(String(label))} formatter={(value: number, name) => [`₹${formatNumber(value)}`, name]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }} /><Customized component={(props: any) => { const xAxis = Object.values(props?.xAxisMap ?? {})[0] as any; const yAxis = Object.values(props?.yAxisMap ?? {})[0] as any; const xScale = xAxis?.scale; const yScale = yAxis?.scale; if (!xScale || !yScale) return <g />; const band = xScale.bandwidth?.() ?? 8; const width = Math.max(2, band * 0.58); return <g>{candles.map((row) => { const x = xScale(row.date) + band / 2; const up = row.close >= row.open; const color = up ? "hsl(var(--primary))" : "hsl(var(--destructive))"; return <g key={row.date}><line x1={x} x2={x} y1={yScale(row.high)} y2={yScale(row.low)} stroke={color} strokeWidth={1} /><rect x={x - width / 2} y={Math.min(yScale(row.open), yScale(row.close))} width={width} height={Math.max(1, Math.abs(yScale(row.open) - yScale(row.close)))} fill={color} /></g>; })}</g>; }} /><Line type="monotone" dataKey="shortSma" name={`SMA ${shortSma}`} stroke="hsl(var(--accent))" dot={false} connectNulls /><Line type="monotone" dataKey="longSma" name={`SMA ${longSma}`} stroke="hsl(var(--warning))" dot={false} connectNulls />{crossovers.map((item) => <ReferenceDot key={`${item.date}-${item.type}`} x={item.date} y={candles.find((candle) => candle.date === item.date)?.close} r={4} fill={item.type === "Bullish" ? "hsl(var(--primary))" : "hsl(var(--destructive))"} stroke="hsl(var(--background))" />)}</ComposedChart></ResponsiveContainer></div> : <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">{chartLoading ? "Loading daily candles…" : "No chart data loaded."}</div>}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground"><span>Daily candles</span><span className="text-accent">SMA {shortSma}</span><span className="text-warning">SMA {longSma}</span><span>{crossovers.length} crossover markers</span></div>
              </CardContent>
            </Card>

            <Card className="glass-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BrainCircuit className="h-4 w-4 text-accent" />Trend context & risk notes</CardTitle><p className="text-sm text-muted-foreground">A concise explanation of recent candle structure and the selected crossover. Not investment advice.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className="space-y-2 text-sm"><span className="text-muted-foreground">Crossover signal</span><select aria-label="Crossover signal" value={selectedSignalType} onChange={(event) => setSelectedSignalType(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option>Bullish</option><option>Bearish</option><option>No recent crossover</option></select></label><Button onClick={() => void explainSelectedTrend()} disabled={analysisLoading || chartLoading || !selectedTicker.trim()} className="self-end gap-2">{analysisLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}{analysisLoading ? "Analyzing…" : "Explain trend & risks"}</Button></div>{analysis && <div className="whitespace-pre-wrap rounded-md border border-border/50 bg-secondary/20 p-4 text-sm leading-relaxed">{analysis}</div>}</CardContent></Card>
          </TabsContent>
        </Tabs>
      )}

      {error && <Alert variant="destructive"><AlertTitle>Could not complete that Kite request</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
  );
};

export default Zerodha;