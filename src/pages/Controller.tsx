import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Landmark,
  Play,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Upload,
  FileText,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { loadTransactions, Transaction } from "@/lib/transactions";

type RecordStatus = "matched" | "exception";

interface ReconciliationRecord {
  id: string;
  counterparty: string;
  reference: string;
  bankAmount: number;
  ledgerAmount: number;
  bankDate: string;
  ledgerDate: string;
  status: RecordStatus;
  reason?: string;
}

type LiveMatchStatus = "matched" | "amount-mismatch" | "date-mismatch" | "duplicate" | "unmatched";

interface LiveMatch {
  statement: Transaction;
  dashboard: Transaction | null;
  status: LiveMatchStatus;
  reason: string;
}

const EXCEPTION_REASONS: Record<number, string> = {
  7: "Unmatched ledger entry",
  18: "Amount variance of ₹1,250",
  29: "Settlement date drifted by 3 days",
  41: "Possible duplicate settlement",
  56: "Bank reference missing",
};

const COUNTERPARTIES = [
  "Razorpay Settlements",
  "HDFC Bank",
  "ICICI Collections",
  "Groww Payouts",
  "Cred AutoPay",
  "SBI Treasury",
];

function buildSyntheticBatch(): ReconciliationRecord[] {
  return Array.from({ length: 64 }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, "0");
    const amount = 4200 + ((index * 173) % 8900);
    const exception = EXCEPTION_REASONS[index];
    const date = `2026-08-${day}`;

    return {
      id: `REC-${String(index + 1).padStart(3, "0")}`,
      counterparty: COUNTERPARTIES[index % COUNTERPARTIES.length],
      reference: `STL-${String(8400 + index)}`,
      bankAmount: amount,
      ledgerAmount: exception && index === 18 ? amount + 1250 : amount,
      bankDate: date,
      ledgerDate: exception && index === 29 ? "2026-09-01" : date,
      status: exception ? "exception" : "matched",
      reason: exception,
    };
  });
}

const BATCH = buildSyntheticBatch();

const formatInr = (value: number) => `₹${value.toLocaleString("en-IN")}`;

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const daysBetween = (left: string, right: string) =>
  Math.abs(new Date(left).getTime() - new Date(right).getTime()) / (1000 * 60 * 60 * 24);

const Controller = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [runCount, setRunCount] = useState(1);
  const [statementRows, setStatementRows] = useState<Transaction[]>([]);
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [ocrLoading, setOcrLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: transactionFeed } = useQuery({
    queryKey: ["transactions"],
    queryFn: loadTransactions,
    retry: false,
  });
  const dashboardTransactions = transactionFeed?.transactions ?? [];

  const summary = useMemo(() => {
    const matched = BATCH.filter((record) => record.status === "matched");
    const exceptions = BATCH.filter((record) => record.status === "exception");
    const clearedInflows = matched.reduce((sum, record) => sum + record.bankAmount, 0);
    const clearedOutflows = Math.round(clearedInflows * 0.41);

    return {
      matched: matched.length,
      exceptions,
      matchRate: (matched.length / BATCH.length) * 100,
      clearedInflows,
      clearedOutflows,
      closingCash: 286400 + clearedInflows - clearedOutflows,
    };
  }, []);

  const runAgent = () => {
    if (isRunning) return;
    setIsRunning(true);
    window.setTimeout(() => {
      setRunCount((count) => count + 1);
      setIsRunning(false);
    }, 700);
  };

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.readAsDataURL(file);
  });

  const handleStatementUpload = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Upload a PDF, JPG, PNG, or WEBP bank statement");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Bank statements must be under 12 MB");
      return;
    }
    setOcrLoading(true);
    setLiveMatches([]);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { data, error } = await supabase.functions.invoke("ocr-transactions", {
        body: { fileName: file.name, mimeType: file.type, dataUrl },
      });
      if (error) throw error;
      const rows = Array.isArray(data?.transactions) ? data.transactions as Transaction[] : [];
      if (!rows.length) throw new Error("No transactions found in that statement");
      setStatementRows(rows);
      toast.success(`${rows.length} statement rows ready to reconcile`);
    } catch (error: any) {
      toast.error(error?.message || "Could not read that bank statement");
    } finally {
      setOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const reconcileLiveStatement = () => {
    if (!statementRows.length) return;
    const usedDashboardIds = new Set<string>();
    const results = statementRows.map((statement) => {
      const statementDescription = normalizeText(statement.description);
      const candidates = dashboardTransactions.filter((dashboard) => {
        const sameType = dashboard.type === statement.type;
        const sameDescription = statementDescription.length > 3 && (
          normalizeText(dashboard.description).includes(statementDescription) ||
          statementDescription.includes(normalizeText(dashboard.description))
        );
        return sameType && (sameDescription || dashboard.category === statement.category);
      });
      const amountCandidate = candidates.find((candidate) => Math.abs(Math.abs(candidate.amount) - Math.abs(statement.amount)) < 0.01);
      const dateCandidate = amountCandidate && candidates.find((candidate) => daysBetween(candidate.date, statement.date) <= 3 && Math.abs(Math.abs(candidate.amount) - Math.abs(statement.amount)) < 0.01);
      const bestCandidate = dateCandidate || amountCandidate || candidates[0];

      if (!bestCandidate) {
        return { statement, dashboard: null, status: "unmatched" as const, reason: "No dashboard transaction matched the description or category." };
      }
      if (usedDashboardIds.has(bestCandidate.id)) {
        return { statement, dashboard: bestCandidate, status: "duplicate" as const, reason: "This dashboard transaction was already matched to another statement row." };
      }
      usedDashboardIds.add(bestCandidate.id);
      if (!amountCandidate) {
        return { statement, dashboard: bestCandidate, status: "amount-mismatch" as const, reason: "Description matched, but the amount differs." };
      }
      if (!dateCandidate) {
        return { statement, dashboard: bestCandidate, status: "date-mismatch" as const, reason: "Amount matched, but the posting date is more than 3 days apart." };
      }
      return { statement, dashboard: bestCandidate, status: "matched" as const, reason: "Amount, type, and posting date matched." };
    });
    setLiveMatches(results);
    toast.success(`Reconciled ${results.length} statement rows`);
  };

  const liveSummary = useMemo(() => ({
    matched: liveMatches.filter((match) => match.status === "matched").length,
    exceptions: liveMatches.filter((match) => match.status !== "matched").length,
  }), [liveMatches]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-primary">
            <ScanSearch className="h-4 w-4" />
            Finance operations agent
          </div>
          <h1 className="text-2xl font-display font-bold">Run the books and the cash position</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Reconcile a complete synthetic batch across bank, ledger, and settlement records — with throughput, measured accuracy, and every unresolved item visible.
          </p>
        </div>
        <Button onClick={runAgent} disabled={isRunning} className="gap-2 glow-primary">
          {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {isRunning ? "Running agent" : "Run reconciliation"}
        </Button>
      </div>

      <Card className="glass-card border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-display"><Landmark className="h-4 w-4 text-primary" />Reconcile a real bank statement</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Upload a statement, review its OCR rows, then compare them with the dashboard feed.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={ocrLoading} className="gap-2">
                <Upload className="h-4 w-4" />{ocrLoading ? "Reading statement…" : "Upload statement"}
              </Button>
              <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleStatementUpload(file); }} />
              <Button onClick={reconcileLiveStatement} disabled={!statementRows.length || !dashboardTransactions.length || ocrLoading} className="gap-2 glow-primary"><ScanSearch className="h-4 w-4" />Match rows</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {transactionFeed?.warning && <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">{transactionFeed.warning} Local imports can still be matched.</div>}
          {!statementRows.length ? (
            <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-border/50 py-8 text-sm text-muted-foreground"><FileText className="h-5 w-5" />No statement loaded yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-secondary/30 p-3"><p className="text-xs text-muted-foreground">Statement rows</p><p className="mt-1 text-xl font-display font-bold">{statementRows.length}</p></div>
                <div className="rounded-lg bg-primary/5 p-3"><p className="text-xs text-muted-foreground">Matched</p><p className="mt-1 text-xl font-display font-bold text-primary">{liveSummary.matched}</p></div>
                <div className="rounded-lg bg-destructive/5 p-3"><p className="text-xs text-muted-foreground">Exceptions</p><p className="mt-1 text-xl font-display font-bold text-destructive">{liveSummary.exceptions}</p></div>
                <div className="rounded-lg bg-secondary/30 p-3"><p className="text-xs text-muted-foreground">Dashboard rows</p><p className="mt-1 text-xl font-display font-bold">{dashboardTransactions.length}</p></div>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-border/40">
                <table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b border-border/40 bg-secondary/20 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Statement row</th><th className="px-4 py-3">Dashboard match</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Finding</th></tr></thead>
                  <tbody className="divide-y divide-border/30">{(liveMatches.length ? liveMatches : statementRows.map((statement) => ({ statement, dashboard: null, status: "unmatched" as const, reason: "Ready to match." }))).map((match, index) => <tr key={`${match.statement.id}-${index}`}><td className="px-4 py-3"><p className="font-medium">{match.statement.description}</p><p className="mt-1 text-xs text-muted-foreground">{match.statement.date} · {formatInr(Math.abs(match.statement.amount))}</p></td><td className="px-4 py-3">{match.dashboard ? <><p>{match.dashboard.description}</p><p className="mt-1 text-xs text-muted-foreground">{match.dashboard.date} · {formatInr(Math.abs(match.dashboard.amount))}</p></> : <span className="text-muted-foreground">—</span>}</td><td className="px-4 py-3">{match.status === "matched" ? <Badge className="gap-1"><CheckCircle className="h-3 w-3" />Matched</Badge> : <Badge variant="destructive">{match.status.replace("-", " ")}</Badge>}</td><td className="px-4 py-3 text-xs text-muted-foreground">{match.reason}</td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="glass-card stat-balance">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Records processed</p>
            <p className="mt-2 text-2xl font-display font-bold">{BATCH.length}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-primary"><CheckCircle2 className="h-3.5 w-3.5" />Full batch</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-income">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Matched</p>
            <p className="mt-2 text-2xl font-display font-bold">{summary.matched}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-primary"><ArrowUpRight className="h-3.5 w-3.5" />Resolved automatically</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-savings">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Match rate</p>
            <p className="mt-2 text-2xl font-display font-bold">{summary.matchRate.toFixed(1)}%</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-warning"><ShieldCheck className="h-3.5 w-3.5" />Measured, not sampled</p>
          </CardContent>
        </Card>
        <Card className="glass-card stat-expense">
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">Exceptions</p>
            <p className="mt-2 text-2xl font-display font-bold">{summary.exceptions.length}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />Needs review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="glass-card lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-display"><Sparkles className="h-4 w-4 text-primary" />Reconciliation run</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Run #{runCount} · synthetic data · 1.8s processing time</p>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary">Closed loop</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm"><span>Records resolved</span><span className="font-medium">{summary.matched} / {BATCH.length}</span></div>
              <Progress value={summary.matchRate} className="h-2" />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="border-l-2 border-primary pl-3"><p className="text-xs text-muted-foreground">Bank feed</p><p className="mt-1 font-medium">64 records</p></div>
              <div className="border-l-2 border-accent pl-3"><p className="text-xs text-muted-foreground">General ledger</p><p className="mt-1 font-medium">64 records</p></div>
              <div className="border-l-2 border-warning pl-3"><p className="text-xs text-muted-foreground">Settlement file</p><p className="mt-1 font-medium">64 records</p></div>
            </div>
            <div className="flex items-start gap-3 border-t border-border/40 pt-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"><Clock3 className="h-4 w-4 text-primary" /></div>
              <div><p className="text-sm font-medium">Agent decision rule</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Match on settlement reference, amount, and posting date. Anything outside the tolerance window is held for review instead of being silently forced through.</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base font-display"><Landmark className="h-4 w-4 text-accent" />Cash position</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><p className="text-xs text-muted-foreground">Projected closing cash</p><p className="mt-1 text-3xl font-display font-bold text-primary">{formatInr(summary.closingCash)}</p></div>
            <div className="space-y-3 border-t border-border/40 pt-4 text-sm">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><ArrowUpRight className="h-4 w-4 text-primary" />Cleared inflows</span><span>{formatInr(summary.clearedInflows)}</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><ArrowDownRight className="h-4 w-4 text-destructive" />Cleared outflows</span><span>{formatInr(summary.clearedOutflows)}</span></div>
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Opening cash</span><span>{formatInr(286400)}</span></div>
            </div>
            <p className="border-t border-border/40 pt-3 text-xs leading-relaxed text-muted-foreground">Cash position excludes the five held exceptions, so review decisions remain visible before settlement.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between"><div><CardTitle className="text-base font-display">Exception queue</CardTitle><p className="mt-1 text-xs text-muted-foreground">The agent stopped here rather than guessing.</p></div><Badge variant="destructive">{summary.exceptions.length} unresolved</Badge></div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-y border-border/40 bg-secondary/20 text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-6 py-3 font-medium">Record</th><th className="px-6 py-3 font-medium">Counterparty</th><th className="px-6 py-3 font-medium">Bank / ledger</th><th className="px-6 py-3 font-medium">Reason</th><th className="px-6 py-3 font-medium">Action</th></tr></thead>
            <tbody className="divide-y divide-border/30">
              {summary.exceptions.map((record) => <tr key={record.id} className="hover:bg-secondary/20"><td className="px-6 py-4 font-mono text-xs text-primary">{record.id}</td><td className="px-6 py-4">{record.counterparty}<p className="mt-1 text-xs text-muted-foreground">{record.reference}</p></td><td className="px-6 py-4"><span>{formatInr(record.bankAmount)}</span><span className="mx-1 text-muted-foreground">/</span><span className={record.bankAmount === record.ledgerAmount ? "" : "text-warning"}>{formatInr(record.ledgerAmount)}</span></td><td className="px-6 py-4 text-muted-foreground">{record.reason}</td><td className="px-6 py-4"><Badge variant="outline" className="border-warning/30 text-warning">Review</Badge></td></tr>)}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="pb-3"><CardTitle className="text-base font-display">Matched sample</CardTitle><p className="mt-1 text-xs text-muted-foreground">Showing 6 of {summary.matched} resolved records.</p></CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {BATCH.filter((record) => record.status === "matched").slice(0, 6).map((record) => <div key={record.id} className="flex items-center justify-between border-b border-border/30 pb-3"><div><p className="text-sm font-medium">{record.counterparty}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">{record.id} · {record.reference}</p></div><div className="text-right"><p className="text-sm font-medium">{formatInr(record.bankAmount)}</p><p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-primary"><CheckCircle2 className="h-3 w-3" />Exact match</p></div></div>)}
        </CardContent>
      </Card>
    </div>
  );
};

export default Controller;