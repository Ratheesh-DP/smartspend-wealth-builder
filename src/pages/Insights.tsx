import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { loadTransactions } from "@/lib/transactions";
import {
  AlertTriangle,
  Info,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Wallet,
  Brain,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

type AlertLevel = "tip" | "warning" | "critical";
interface Alert {
  level: AlertLevel;
  title: string;
  message: string;
}

const chartTooltipStyle = {
  background: "hsl(220, 18%, 7%)",
  border: "1px solid hsl(220, 14%, 14%)",
  borderRadius: "0.5rem",
  color: "hsl(210, 20%, 95%)",
};

const monthKey = (d: string) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (k: string) => {
  const [y, m] = k.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
};

const classifyPersonality = (
  savingsRate: number,
  topCategoryShare: number,
  topCategory: string,
  txCount: number,
) => {
  if (txCount === 0)
    return {
      name: "Unclassified",
      tagline: "Add transactions to discover your spending personality.",
      icon: Brain,
      color: "text-muted-foreground",
    };
  if (savingsRate >= 30)
    return {
      name: "The Strategist",
      tagline: "You save aggressively and spend with intent. Wealth-builder mindset.",
      icon: Sparkles,
      color: "text-primary",
    };
  if (savingsRate >= 15)
    return {
      name: "The Balanced Saver",
      tagline: "Healthy mix of spending and saving — keep building that buffer.",
      icon: Wallet,
      color: "text-accent",
    };
  if (savingsRate >= 0 && topCategoryShare < 0.4)
    return {
      name: "The Steady Spender",
      tagline: "Living within means but saving little. Time to automate savings.",
      icon: TrendingUp,
      color: "text-warning",
    };
  if (topCategoryShare >= 0.4)
    return {
      name: `The ${topCategory} Enthusiast`,
      tagline: `A large slice of your spend goes to ${topCategory}. Worth a closer look.`,
      icon: AlertTriangle,
      color: "text-warning",
    };
  return {
    name: "The Overspender",
    tagline: "Expenses outpace income. Tighten the belt and rebuild the runway.",
    icon: ShieldAlert,
    color: "text-destructive",
  };
};

const alertStyles: Record<AlertLevel, { bg: string; border: string; icon: typeof Info; iconColor: string; label: string }> = {
  tip: {
    bg: "bg-primary/5",
    border: "border-primary/30",
    icon: Info,
    iconColor: "text-primary",
    label: "Tip",
  },
  warning: {
    bg: "bg-warning/5",
    border: "border-warning/30",
    icon: AlertTriangle,
    iconColor: "text-warning",
    label: "Warning",
  },
  critical: {
    bg: "bg-destructive/5",
    border: "border-destructive/40",
    icon: ShieldAlert,
    iconColor: "text-destructive",
    label: "Critical",
  },
};

const Insights = () => {
  const { user } = useAuth();

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: loadTransactions,
    enabled: !!user,
  });

  const analytics = useMemo(() => {
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const savingsRate = totalIncome > 0 ? (totalIncome - totalExpense) / totalIncome : 0;

    const byCategory: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount);
      });
    const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const topCategory = sortedCats[0]?.[0] || "N/A";
    const topCategoryAmount = sortedCats[0]?.[1] || 0;
    const topCategoryShare = totalExpense > 0 ? topCategoryAmount / totalExpense : 0;

    // Monthly aggregation
    const monthly: Record<string, { income: number; expense: number }> = {};
    transactions.forEach((t) => {
      const k = monthKey(t.date);
      if (!monthly[k]) monthly[k] = { income: 0, expense: 0 };
      if (t.type === "income") monthly[k].income += Math.abs(t.amount);
      else monthly[k].expense += Math.abs(t.amount);
    });
    const monthlyArr = Object.entries(monthly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({
        month: monthLabel(k),
        key: k,
        income: v.income,
        expense: v.expense,
        net: v.income - v.expense,
      }));

    const last = monthlyArr[monthlyArr.length - 1];
    const prev = monthlyArr[monthlyArr.length - 2];
    const monthlyExpenseDelta =
      last && prev && prev.expense > 0 ? (last.expense - prev.expense) / prev.expense : 0;

    const avgExpense =
      monthlyArr.length > 0
        ? monthlyArr.reduce((s, m) => s + m.expense, 0) / monthlyArr.length
        : 0;

    return {
      totalIncome,
      totalExpense,
      savingsRate,
      sortedCats,
      topCategory,
      topCategoryAmount,
      topCategoryShare,
      monthlyArr,
      monthlyExpenseDelta,
      avgExpense,
      last,
      prev,
    };
  }, [transactions]);

  const alerts = useMemo<Alert[]>(() => {
    const a: Alert[] = [];
    const {
      totalIncome,
      totalExpense,
      savingsRate,
      topCategory,
      topCategoryShare,
      monthlyExpenseDelta,
      last,
      avgExpense,
    } = analytics;

    if (transactions.length === 0) return a;

    // Critical alerts
    if (totalIncome > 0 && totalExpense > totalIncome) {
      a.push({
        level: "critical",
        title: "Spending exceeds income",
        message: `You've spent ₹${(totalExpense - totalIncome).toLocaleString("en-IN")} more than you earned. Cut non-essential expenses immediately.`,
      });
    }
    if (totalIncome > 0 && savingsRate < 0) {
      a.push({
        level: "critical",
        title: "Negative savings rate",
        message: "You're burning into reserves. Pause discretionary categories like Shopping and Entertainment this month.",
      });
    }
    if (monthlyExpenseDelta >= 0.5 && last) {
      a.push({
        level: "critical",
        title: "Expenses spiked sharply",
        message: `Your expenses jumped ${(monthlyExpenseDelta * 100).toFixed(0)}% vs last month. Review recent large transactions.`,
      });
    }

    // Warnings
    if (topCategoryShare >= 0.4 && topCategory !== "N/A") {
      a.push({
        level: "warning",
        title: `${topCategory} dominates your spending`,
        message: `${(topCategoryShare * 100).toFixed(0)}% of expenses go to ${topCategory}. Consider setting a category cap.`,
      });
    }
    if (savingsRate >= 0 && savingsRate < 0.1 && totalIncome > 0) {
      a.push({
        level: "warning",
        title: "Low savings rate",
        message: `You're only saving ${(savingsRate * 100).toFixed(1)}%. Target at least 20% for long-term wealth.`,
      });
    }
    if (last && avgExpense > 0 && last.expense > avgExpense * 1.25) {
      a.push({
        level: "warning",
        title: "Above your usual spend",
        message: `This month is ${((last.expense / avgExpense - 1) * 100).toFixed(0)}% above your average. Pace yourself.`,
      });
    }

    // Tips
    if (savingsRate >= 0.3) {
      a.push({
        level: "tip",
        title: "You're a power saver",
        message: "Park surplus in equity SIPs or PPF to make it work harder than a savings account.",
      });
    }
    if (savingsRate >= 0.15 && savingsRate < 0.3) {
      a.push({
        level: "tip",
        title: "Build an emergency fund",
        message: "Aim for 6 months of expenses in a liquid fund before scaling up investments.",
      });
    }
    if (monthlyExpenseDelta < -0.1 && last) {
      a.push({
        level: "tip",
        title: "Great cost control",
        message: `Expenses dropped ${Math.abs(monthlyExpenseDelta * 100).toFixed(0)}% vs last month. Redirect the savings to an investment goal.`,
      });
    }
    if (a.length === 0) {
      a.push({
        level: "tip",
        title: "All quiet on the money front",
        message: "No anomalies detected. Keep logging transactions for sharper insights.",
      });
    }

    return a;
  }, [analytics, transactions.length]);

  const personality = classifyPersonality(
    analytics.savingsRate,
    analytics.topCategoryShare,
    analytics.topCategory,
    transactions.length,
  );

  const order: AlertLevel[] = ["critical", "warning", "tip"];
  const sortedAlerts = [...alerts].sort(
    (a, b) => order.indexOf(a.level) - order.indexOf(b.level),
  );

  const PIcon = personality.icon;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">
          <span className="text-primary">Smart</span> Insights
        </h1>
        <p className="text-muted-foreground text-sm">
          Rule-based alerts, spending personality, and trend analysis tailored to your money.
        </p>
      </div>

      {/* Personality + Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="glass-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> Spending Personality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <PIcon className={`w-7 h-7 ${personality.color}`} />
              </div>
              <div>
                <p className={`text-xl font-display font-bold ${personality.color}`}>
                  {personality.name}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{personality.tagline}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-5">
              <div className="glass-card rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Savings Rate</p>
                <p className="font-display font-bold text-lg">
                  {(analytics.savingsRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="glass-card rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Top Category</p>
                <p className="font-display font-bold text-lg truncate">
                  {analytics.topCategory}
                </p>
              </div>
              <div className="glass-card rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Avg / Month</p>
                <p className="font-display font-bold text-lg">
                  ₹{Math.round(analytics.avgExpense).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">This Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Income</span>
              <span className="font-display font-bold text-primary">
                ₹{(analytics.last?.income || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Expense</span>
              <span className="font-display font-bold text-destructive">
                ₹{(analytics.last?.expense || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border/30">
              <span className="text-xs text-muted-foreground">vs last month</span>
              <span
                className={`text-sm font-display font-semibold flex items-center gap-1 ${
                  analytics.monthlyExpenseDelta > 0 ? "text-destructive" : "text-primary"
                }`}
              >
                {analytics.monthlyExpenseDelta > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {analytics.prev
                  ? `${(analytics.monthlyExpenseDelta * 100).toFixed(0)}%`
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">Alerts & Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sortedAlerts.map((alert, i) => {
            const s = alertStyles[alert.level];
            const Icon = s.icon;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${s.bg} ${s.border}`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.bg}`}
                >
                  <Icon className={`w-4 h-4 ${s.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-semibold text-sm">{alert.title}</p>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${s.iconColor} ${s.bg} border ${s.border}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Trend analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Net Cashflow Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.monthlyArr.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={analytics.monthlyArr}>
                  <defs>
                    <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 14%)" />
                  <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" fontSize={11} />
                  <YAxis
                    stroke="hsl(215, 15%, 55%)"
                    fontSize={11}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Net"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="hsl(38, 92%, 50%)"
                    strokeWidth={2}
                    fill="url(#netGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                Add transactions to see trends
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Income vs Expense</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.monthlyArr.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={analytics.monthlyArr}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 14%)" />
                  <XAxis dataKey="month" stroke="hsl(215, 15%, 55%)" fontSize={11} />
                  <YAxis
                    stroke="hsl(215, 15%, 55%)"
                    fontSize={11}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                  />
                  <Bar dataKey="income" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-muted-foreground text-sm">
                Add transactions to compare
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Category breakdown */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">Top Categories</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.sortedCats.length > 0 ? (
            <div className="space-y-3">
              {analytics.sortedCats.slice(0, 6).map(([cat, amt]) => {
                const pct = analytics.totalExpense > 0 ? (amt / analytics.totalExpense) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-medium">{cat}</span>
                      <span className="text-muted-foreground">
                        ₹{amt.toLocaleString("en-IN")} · {pct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground text-sm">
              No expense data yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Insights;
