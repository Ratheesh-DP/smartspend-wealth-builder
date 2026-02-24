import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const overviewCards = [
  { title: "Total Income", value: "₹1,25,000", change: "+12%", icon: TrendingUp, positive: true },
  { title: "Total Expenses", value: "₹68,450", change: "+5%", icon: TrendingDown, positive: false },
  { title: "Savings", value: "₹56,550", change: "+22%", icon: PiggyBank, positive: true },
  { title: "Budget Left", value: "₹31,550", change: "42%", icon: Wallet, positive: true },
];

const categoryData = [
  { name: "Food", value: 18500, color: "hsl(156, 72%, 45%)" },
  { name: "Rent", value: 22000, color: "hsl(186, 72%, 45%)" },
  { name: "Shopping", value: 8400, color: "hsl(38, 92%, 50%)" },
  { name: "Travel", value: 6200, color: "hsl(280, 65%, 60%)" },
  { name: "Bills", value: 9350, color: "hsl(0, 72%, 51%)" },
  { name: "Entertainment", value: 4000, color: "hsl(210, 60%, 55%)" },
];

const trendData = [
  { month: "Sep", income: 110000, expenses: 62000 },
  { month: "Oct", income: 115000, expenses: 71000 },
  { month: "Nov", income: 108000, expenses: 58000 },
  { month: "Dec", income: 125000, expenses: 75000 },
  { month: "Jan", income: 120000, expenses: 65000 },
  { month: "Feb", income: 125000, expenses: 68450 },
];

const recentTransactions = [
  { id: 1, desc: "Swiggy Order", category: "Food", amount: -450, date: "Today" },
  { id: 2, desc: "Salary Credit", category: "Income", amount: 125000, date: "1 Feb" },
  { id: 3, desc: "Amazon Purchase", category: "Shopping", amount: -2199, date: "28 Jan" },
  { id: 4, desc: "Electricity Bill", category: "Bills", amount: -1850, date: "27 Jan" },
  { id: 5, desc: "Uber Ride", category: "Travel", amount: -320, date: "26 Jan" },
];

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your financial overview for February 2026</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {overviewCards.map((card) => (
          <Card key={card.title} className="glass border-border/30">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{card.title}</span>
                <card.icon className={`w-4 h-4 ${card.positive ? "text-primary" : "text-destructive"}`} />
              </div>
              <p className="text-2xl font-display font-bold">{card.value}</p>
              <p className={`text-xs mt-1 ${card.positive ? "text-primary" : "text-destructive"}`}>
                {card.change} vs last month
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Spending Breakdown */}
        <Card className="glass border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Spending Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
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
                  contentStyle={{
                    background: "hsl(220 18% 7%)",
                    border: "1px solid hsl(220 14% 14%)",
                    borderRadius: "0.5rem",
                    color: "hsl(210 20% 95%)",
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {categoryData.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="ml-auto font-medium">₹{(c.value / 1000).toFixed(1)}k</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Trend Chart */}
        <Card className="lg:col-span-2 glass border-border/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 14% 14%)" />
                <XAxis dataKey="month" stroke="hsl(215 15% 55%)" fontSize={12} />
                <YAxis stroke="hsl(215 15% 55%)" fontSize={12} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(220 18% 7%)",
                    border: "1px solid hsl(220 14% 14%)",
                    borderRadius: "0.5rem",
                    color: "hsl(210 20% 95%)",
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString("en-IN")}`, ""]}
                />
                <Line type="monotone" dataKey="income" stroke="hsl(156, 72%, 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expenses" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="glass border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div>
                  <p className="text-sm font-medium">{tx.desc}</p>
                  <p className="text-xs text-muted-foreground">{tx.category} · {tx.date}</p>
                </div>
                <span className={`text-sm font-display font-semibold ${tx.amount > 0 ? "text-primary" : "text-destructive"}`}>
                  {tx.amount > 0 ? "+" : ""}₹{Math.abs(tx.amount).toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
