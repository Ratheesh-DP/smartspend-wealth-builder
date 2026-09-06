import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BellRing, PiggyBank, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useFormatAmount } from "@/contexts/PreferencesContext";
import { loadTransactions } from "@/lib/transactions";
import { loadBudgets, removeBudget, saveBudget, Budget as BudgetRecord } from "@/lib/budgets";

const CATEGORIES = [
  "Food", "Shopping", "Travel", "Bills", "Entertainment", "Education", "Housing",
  "Transport", "Utilities", "Health", "Investment", "Other",
];

const formatMonth = (month: number, year: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

const Budget = () => {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const fmt = useFormatAmount();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");

  const { data: transactionFeed, isLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: loadTransactions,
    retry: false,
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", month, year],
    queryFn: () => loadBudgets(month, year),
  });
  const transactions = transactionFeed?.transactions ?? [];

  const spentByCategory = useMemo(() => {
    const totals: Record<string, number> = {};
    transactions
      .filter((transaction) => transaction.type === "expense")
      .filter((transaction) => {
        const date = new Date(transaction.date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      })
      .forEach((transaction) => {
        totals[transaction.category] = (totals[transaction.category] || 0) + Math.abs(transaction.amount);
      });
    return totals;
  }, [month, transactions, year]);

  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const totalSpent = budgets.reduce((sum, budget) => sum + (spentByCategory[budget.category] || 0), 0);
  const overLimitCount = budgets.filter((budget) => (spentByCategory[budget.category] || 0) > budget.amount).length;

  const addBudget = () => {
    const numericAmount = Number(amount);
    if (!category || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error("Choose a category and enter a positive monthly limit");
      return;
    }
    saveBudget(category, numericAmount, month, year);
    queryClient.invalidateQueries({ queryKey: ["budgets", month, year] });
    setCategory("");
    setAmount("");
    toast.success(`${category} budget saved`);
  };

  const deleteBudget = (budget: BudgetRecord) => {
    removeBudget(budget.id);
    queryClient.invalidateQueries({ queryKey: ["budgets", month, year] });
    toast.success(`${budget.category} budget removed`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Budgets</h1>
          <p className="text-muted-foreground text-sm">Plan category limits and keep this month on track.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PiggyBank className="h-4 w-4 text-primary" />
          {formatMonth(month, year)}
        </div>
      </div>

      {transactionFeed?.warning && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          {transactionFeed.warning}
        </div>
      )}

      {overLimitCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div><strong>{overLimitCount} {overLimitCount === 1 ? "category is" : "categories are"} over budget.</strong> Review the red progress bars below.</div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass-card"><CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">Total monthly limits</p>
          <p className="mt-2 text-2xl font-display font-bold">{fmt(totalBudget)}</p>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">Spent against limits</p>
          <p className="mt-2 text-2xl font-display font-bold">{fmt(totalSpent)}</p>
        </CardContent></Card>
        <Card className="glass-card"><CardContent className="pt-5">
          <p className="text-sm text-muted-foreground">Remaining</p>
          <p className={`mt-2 text-2xl font-display font-bold ${totalBudget - totalSpent < 0 ? "text-destructive" : "text-primary"}`}>
            {fmt(totalBudget - totalSpent)}
          </p>
        </CardContent></Card>
      </div>

      <Card className="glass-card border-border/30">
        <CardHeader className="pb-4"><CardTitle className="text-base font-display">Set a category limit</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Monthly limit (₹)</Label>
              <Input type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 10000" />
            </div>
            <Button onClick={addBudget} className="gap-1.5 glow-primary"><Plus className="h-4 w-4" />Save limit</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-border/30">
        <CardHeader className="pb-3"><CardTitle className="text-base font-display">Monthly progress</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="py-8 text-center text-sm text-muted-foreground">Loading spending…</div> : budgets.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground"><BellRing className="mx-auto mb-3 h-8 w-8 opacity-40" />Set your first category limit to start tracking.</div>
          ) : (
            <div className="space-y-5">
              {budgets.map((budget) => {
                const spent = spentByCategory[budget.category] || 0;
                const ratio = budget.amount > 0 ? spent / budget.amount : 0;
                const progress = Math.min(ratio * 100, 100);
                const over = ratio > 1;
                return <div key={budget.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0"><span className="font-medium">{budget.category}</span><span className="ml-2 text-muted-foreground">{fmt(spent)} of {fmt(budget.amount)}</span></div>
                    <div className="flex items-center gap-2 shrink-0"><span className={over ? "text-destructive font-medium" : "text-muted-foreground"}>{Math.round(ratio * 100)}%</span><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteBudget(budget)} aria-label={`Remove ${budget.category} budget`}><Trash2 className="h-3.5 w-3.5" /></Button></div>
                  </div>
                  <Progress value={progress} className={over ? "[&>div]:bg-destructive" : ""} />
                  <p className={`text-xs ${over ? "text-destructive" : "text-muted-foreground"}`}>{over ? `${fmt(spent - budget.amount)} over limit` : `${fmt(budget.amount - spent)} remaining`}</p>
                </div>;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Budget;
