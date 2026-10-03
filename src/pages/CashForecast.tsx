import { useMemo } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, CircleHelp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadTransactions } from "@/lib/transactions";
import { loadAllBudgets } from "@/lib/budgets";
import { useFormatAmount } from "@/contexts/PreferencesContext";

const CashForecast = () => {
  const fmt = useFormatAmount();
  const { data: feed, isLoading } = useQuery({ queryKey: ["transactions"], queryFn: loadTransactions, retry: false });
  const { data: budgets = [] } = useQuery({ queryKey: ["budgets-all"], queryFn: loadAllBudgets });
  const transactions = feed?.transactions ?? [];

  const projection = useMemo(() => {
    const now = new Date();
    const monthly = new Map<string, { income: number; expense: number }>();
    for (const transaction of transactions) {
      const date = new Date(transaction.date);
      if (!Number.isFinite(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const sums = monthly.get(key) ?? { income: 0, expense: 0 };
      sums[transaction.type] += Math.abs(transaction.amount);
      monthly.set(key, sums);
    }
    const history = Array.from({ length: 3 }, (_, offset) => {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      return monthly.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }).filter((item): item is { income: number; expense: number } => Boolean(item));
    const avgIncome = history.length ? history.reduce((sum, item) => sum + item.income, 0) / history.length : 0;
    const avgExpense = history.length ? history.reduce((sum, item) => sum + item.expense, 0) / history.length : 0;
    const activeBudgets = budgets.filter((budget) => budget.amount > 0);
    const budgetMonthlyTotal = activeBudgets.reduce((sum, budget) => sum + budget.amount, 0);
    const forecastExpense = budgetMonthlyTotal > 0 ? Math.max(avgExpense, budgetMonthlyTotal) : avgExpense;
    let cumulativeChange = 0;
    const months = Array.from({ length: 4 }, (_, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
      const net = avgIncome - forecastExpense;
      cumulativeChange += net;
      return {
        month: d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
        income: Math.round(avgIncome),
        expenses: Math.round(forecastExpense),
        change: Math.round(net),
        cumulative: Math.round(cumulativeChange),
      };
    });
    return { months, avgIncome, avgExpense, forecastExpense, hasHistory: history.length > 0, historyCount: history.length, hasBudgets: budgetMonthlyTotal > 0 };
  }, [transactions, budgets]);

  return <div className="space-y-6">
    <div className="flex items-start gap-3"><div className="mt-1 rounded-md bg-primary/10 p-2 text-primary"><CalendarClock className="h-5 w-5" /></div><div><h1 className="text-2xl font-display font-bold">Cash Forecast</h1><p className="mt-1 text-sm text-muted-foreground">A four-month view of expected net cash movement from your transaction history.</p></div></div>
    {feed?.warning && <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">Google Sheets could not be read. Forecast figures use locally imported transactions only until access is granted and the dashboard is refreshed.</div>}
    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="glass-card stat-income"><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Average monthly income</p><p className="mt-2 text-2xl font-display font-bold">{fmt(projection.avgIncome)}</p></CardContent></Card>
      <Card className="glass-card stat-expense"><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Projected monthly spending</p><p className="mt-2 text-2xl font-display font-bold">{fmt(projection.forecastExpense)}</p></CardContent></Card>
      <Card className="glass-card stat-balance"><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Expected monthly movement</p><p className={`mt-2 text-2xl font-display font-bold ${projection.avgIncome >= projection.forecastExpense ? "text-primary" : "text-destructive"}`}>{fmt(projection.avgIncome - projection.forecastExpense)}</p></CardContent></Card>
    </div>
    <Card className="glass-card"><CardHeader><CardTitle className="text-base">Projected net change from today</CardTitle></CardHeader><CardContent>
      {isLoading ? <div className="py-16 text-center text-sm text-muted-foreground">Loading transactions…</div> : !projection.hasHistory ? <div className="py-12 text-center text-sm text-muted-foreground">Add transactions to build a forecast. No starting cash balance is assumed.</div> : <ResponsiveContainer width="100%" height={300}><AreaChart data={projection.months} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}><defs><linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" /><YAxis tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`} stroke="hsl(var(--muted-foreground))" width={90} /><Tooltip formatter={(value: number) => fmt(value)} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }} /><Area type="monotone" dataKey="cumulative" name="Cumulative net change" stroke="hsl(var(--primary))" fill="url(#forecastGradient)" strokeWidth={2} /></AreaChart></ResponsiveContainer>}
    </CardContent></Card>
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]"><Card className="glass-card"><CardHeader><CardTitle className="text-base">Month-by-month projection</CardTitle></CardHeader><CardContent className="space-y-3">{projection.months.map((month) => <div key={month.month} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3 last:border-0"><div className="min-w-28"><p className="font-medium">{month.month}</p><p className="text-xs text-muted-foreground">Income {fmt(month.income)} · Spend {fmt(month.expenses)}</p></div><span className={`flex items-center gap-1 text-sm font-semibold ${month.change >= 0 ? "text-primary" : "text-destructive"}`}>{month.change >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{fmt(month.change)}</span></div>)}</CardContent></Card>
      <Card className="glass-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CircleHelp className="h-4 w-4 text-accent" />How to read this estimate</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Income and spending are averages from the most recent three calendar months with transactions ({projection.historyCount} month{projection.historyCount === 1 ? "" : "s"} available).</p><p>{projection.hasBudgets ? "Your saved category budgets act as a minimum spending estimate when their total exceeds recent average spending." : "No saved budgets were found, so recent average spending is carried forward."}</p><p>This is net change, not an account balance. It assumes no opening cash, future one-off events, or recurring income that is not present in history. Real outcomes may differ.</p></CardContent></Card></div>
  </div>;
};

export default CashForecast;