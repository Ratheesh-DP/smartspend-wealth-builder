import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, Target, Sparkles, ShieldCheck } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useFormatAmount } from "@/contexts/PreferencesContext";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { loadTransactions } from "@/lib/transactions";

const CATEGORY_COLORS: Record<string, string> = {
  Food: "hsl(38, 92%, 50%)",
  Shopping: "hsl(38, 72%, 55%)",
  Travel: "hsl(280, 65%, 60%)",
  Bills: "hsl(0, 72%, 51%)",
  Entertainment: "hsl(210, 60%, 55%)",
  Education: "hsl(186, 72%, 45%)",
  Housing: "hsl(280, 50%, 50%)",
  Investment: "hsl(0, 60%, 55%)",
  Transport: "hsl(320, 60%, 55%)",
  Utilities: "hsl(156, 50%, 55%)",
  Health: "hsl(156, 72%, 45%)",
  Other: "hsl(215, 15%, 55%)",
};

const chartTooltipStyle = {
  background: "hsl(220, 18%, 7%)",
  border: "1px solid hsl(220, 14%, 14%)",
  borderRadius: "0.5rem",
  color: "hsl(210, 20%, 95%)",
};

const Index = () => {
  const { user } = useAuth();
  const [trendPeriod, setTrendPeriod] = useState("daily");
  const fmt = useFormatAmount();

  const { data: transactionFeed } = useQuery({
    queryKey: ["transactions"],
    queryFn: loadTransactions,
    enabled: !!user,
  });
  const transactions = transactionFeed?.transactions ?? [];

  const stats = useMemo(() => {
    const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + Math.abs(t.amount), 0);
    const balance = totalIncome - totalExpenses;
    return { totalIncome, totalExpenses, balance };
  }, [transactions]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === "expense").forEach(t => {
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || "hsl(215, 15%, 55%)" }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const trendData = useMemo(() => {
    if (transactions.length === 0) return [];
    let balance = 0;
    return transactions.map(t => {
      balance += t.amount;
      return { date: t.date, balance: Math.max(0, balance) };
    });
  }, [transactions]);

  const topCategory = categoryData[0]?.name || "N/A";
  const savingsRate = stats.totalIncome > 0
    ? ((stats.totalIncome - stats.totalExpenses) / stats.totalIncome * 100).toFixed(1)
    : "0";

  const recentTx = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);
  }, [transactions]);

  const overviewCards = [
    { title: "Total Balance", value: stats.balance, icon: Wallet, className: "stat-balance" },
    { title: "Total Income", value: stats.totalIncome, icon: TrendingUp, className: "stat-income" },
    { title: "Total Expenses", value: stats.totalExpenses, icon: TrendingDown, className: "stat-expense" },
  ];

  const hasData = transactions.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">
          <span className="text-primary">Finance</span> Overview
        </h1>
        <p className="text-muted-foreground text-sm">Manage and track your financials seamlessly.</p>
      </div>

      {transactionFeed?.warning && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          {transactionFeed.warning}
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {overviewCards.map((card) => (
          <Card key={card.title} className={`glass-card ${card.className}`}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.title}</span>
                <card.icon className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-2xl font-display font-bold">{fmt(card.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Balance Trend */}
        <Card className="lg:col-span-2 glass-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display">Balance Trend</CardTitle>
              <Select value={trendPeriod} onValueChange={setTrendPeriod}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {hasData ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 14%)" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(215, 15%, 55%)"
                    fontSize={11}
                    tickFormatter={(v) => new Date(v).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                  />
                  <YAxis
                    stroke="hsl(215, 15%, 55%)"
                    fontSize={11}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, "Balance"]}
                    labelFormatter={(l) => new Date(l).toLocaleDateString("en-IN")}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="hsl(38, 92%, 50%)"
                    strokeWidth={2}
                    fill="url(#balanceGrad)"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                Add transactions to see your balance trend
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expenses by Category */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categoryData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, ""]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {categoryData.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-muted-foreground truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                No expense data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2 glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTx.length > 0 ? (
              <div className="space-y-3">
                {recentTx.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.category} · {new Date(tx.date).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <span className={`text-sm font-display font-semibold ${
                      tx.amount > 0 ? "text-primary" : "text-destructive"
                    }`}>
                      {fmt(tx.amount, { signed: true })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-muted-foreground text-sm">No transactions yet</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Insights */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Quick Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                <Target className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Top Expense Category</p>
                <p className="font-display font-bold">{topCategory}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Savings Rate</p>
                <p className="font-display font-bold">{savingsRate}%</p>
                <p className="text-xs text-muted-foreground">of total income saved</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recommendation</p>
                <p className="text-xs">
                  {hasData
                    ? `Consider reducing your budget for ${topCategory} to improve your savings rate this month.`
                    : "Start adding transactions to get personalized insights!"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
