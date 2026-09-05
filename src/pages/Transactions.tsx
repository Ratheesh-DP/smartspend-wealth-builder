import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences, useFormatAmount } from "@/contexts/PreferencesContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Download, Trash2, Upload, FileText } from "lucide-react";
import {
  addLocalTransactions,
  createLocalTransaction,
  isLocalTransaction,
  loadTransactions,
  removeLocalTransaction,
  Transaction,
} from "@/lib/transactions";

const CATEGORIES = [
  "Food", "Shopping", "Travel", "Bills", "Entertainment",
  "Education", "Housing", "Investment", "Transport", "Utilities",
  "Health", "Salary", "Freelance", "Other",
];

const EXPENSE_CATEGORIES = CATEGORIES.filter(c => !["Salary", "Freelance"].includes(c));
const INCOME_CATEGORIES = ["Salary", "Freelance", "Other"];

const Transactions = () => {
  const { user } = useAuth();
  const { isAdmin } = usePreferences();
  const fmt = useFormatAmount();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [csvDragging, setCsvDragging] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrRows, setOcrRows] = useState<Transaction[]>([]);
  const [ocrFileName, setOcrFileName] = useState("");

  // Form state
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formType, setFormType] = useState<"income" | "expense">("expense");
  const [formCategory, setFormCategory] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: transactions = [], isLoading, isError } = useQuery({
    queryKey: ["transactions"],
    queryFn: loadTransactions,
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (tx: Omit<Transaction, "id">) => createLocalTransaction(tx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transaction added");
      resetForm();
      setAddOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isLocalTransaction(transactions.find((transaction) => transaction.id === id) ?? { id } as Transaction)) {
        throw new Error("Google Sheets rows are read-only. Edit the spreadsheet to change them.");
      }
      removeLocalTransaction(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transaction deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const resetForm = () => {
    setFormDesc("");
    setFormAmount("");
    setFormType("expense");
    setFormCategory("");
    setFormDate(new Date().toISOString().split("T")[0]);
  };

  const handleAdd = () => {
    if (!formDesc || !formAmount || !formCategory) {
      toast.error("Please fill all fields");
      return;
    }
    const amount = parseFloat(formAmount);
    addMutation.mutate({
      description: formDesc,
      amount: formType === "expense" ? -Math.abs(amount) : Math.abs(amount),
      type: formType,
      category: formCategory,
      date: formDate,
    });
  };

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        tx.description.toLowerCase().includes(search.toLowerCase()) ||
        tx.category.toLowerCase().includes(search.toLowerCase());
      const matchesType =
        filterType === "all" || tx.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [transactions, search, filterType]);

  const exportData = (format: "csv" | "json") => {
    if (filtered.length === 0) {
      toast.error("No data to export");
      return;
    }
    let content: string;
    let mime: string;
    let ext: string;

    if (format === "csv") {
      const headers = "Date,Description,Category,Amount,Type\n";
      const rows = filtered
        .map((tx) => `${tx.date},${tx.description},${tx.category},${tx.amount},${tx.type}`)
        .join("\n");
      content = headers + rows;
      mime = "text/csv";
      ext = "csv";
    } else {
      content = JSON.stringify(filtered, null, 2);
      mime = "application/json";
      ext = "json";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${ext.toUpperCase()}`);
  };

  const handleCsvUpload = async (file: File) => {
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    const header = lines[0].toLowerCase();

    if (!header.includes("amount") || !header.includes("description")) {
      toast.error("CSV must have 'description' and 'amount' columns");
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const descIdx = headers.indexOf("description");
    const amountIdx = headers.indexOf("amount");
    const catIdx = headers.indexOf("category");
    const dateIdx = headers.indexOf("date");

    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const amount = parseFloat(cols[amountIdx]);
      return {
        id: `csv-${crypto.randomUUID()}`,
        description: cols[descIdx] || "Imported",
        amount,
        type: (amount >= 0 ? "income" : "expense") as "income" | "expense",
        category: cols[catIdx] || "Other",
        date: cols[dateIdx] || new Date().toISOString().split("T")[0],
        source: "csv" as const,
      };
    }).filter((r) => !isNaN(r.amount));

    if (rows.length === 0) {
      toast.error("No valid rows found");
      return;
    }

    addLocalTransactions(rows);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    toast.success(`Imported ${rows.length} transactions`);
  };

  const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the selected file"));
    reader.readAsDataURL(file);
  });

  const handleOcrUpload = async (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast.error("Upload a PDF, JPG, PNG, or WEBP bank statement");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Bank statements must be under 12 MB");
      return;
    }
    setOcrLoading(true);
    setOcrFileName(file.name);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const { data, error } = await supabase.functions.invoke("ocr-transactions", {
        body: { fileName: file.name, mimeType: file.type, dataUrl },
      });
      if (error) throw error;
      const rows = Array.isArray(data?.transactions) ? data.transactions as Transaction[] : [];
      if (!rows.length) throw new Error("No transactions found in that statement");
      setOcrRows(rows);
      toast.success(`Found ${rows.length} transactions — review them below before saving`);
    } catch (error: any) {
      toast.error(error?.message || "Could not read that bank statement");
    } finally {
      setOcrLoading(false);
    }
  };

  const saveOcrRows = () => {
    addLocalTransactions(ocrRows);
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    toast.success(`Saved ${ocrRows.length} OCR transactions from ${ocrFileName}`);
    setOcrRows([]);
    setOcrFileName("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setCsvDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".csv")) {
      handleCsvUpload(file);
    } else {
      toast.error("Please drop a CSV file");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm">
            Track all your income & expenses
          </p>
        </div>
        {isAdmin ? (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5 glow-primary">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border/30">
            <DialogHeader>
              <DialogTitle className="font-display">Add Transaction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={formType} onValueChange={(v) => { setFormType(v as "income" | "expense"); setFormCategory(""); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {(formType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="e.g. Swiggy Order" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Amount (₹)</Label>
                  <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleAdd} disabled={addMutation.isPending} className="w-full glow-primary">
                {addMutation.isPending ? "Adding..." : "Add Transaction"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        ) : (
          <span className="text-xs text-muted-foreground px-2 py-1 rounded-full border border-border/40">
            Viewer mode — switch to Admin in the top bar to add
          </span>
        )}
      </div>

      {isError && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          Google Sheets is not readable yet. Share the spreadsheet with the connected Google account, then refresh.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
      {/* CSV Upload Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setCsvDragging(true); }}
        onDragLeave={() => setCsvDragging(false)}
        onDrop={handleDrop}
        className={`glass-card rounded-lg p-4 text-center cursor-pointer transition-all ${
          csvDragging ? "border-primary/50 bg-primary/5" : ""
        }`}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".csv";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleCsvUpload(file);
          };
          input.click();
        }}
      >
        <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Drag & drop CSV or <span className="text-primary">click to upload</span>
        </p>
      </div>

      <label className="glass-card rounded-lg p-4 text-center cursor-pointer transition-all hover:border-primary/50">
        <FileText className="w-5 h-5 mx-auto mb-1.5 text-primary" />
        <p className="text-sm text-muted-foreground">{ocrLoading ? "Reading statement..." : "Upload bank statement for OCR"}</p>
        <p className="mt-1 text-xs text-muted-foreground/70">PDF, JPG, PNG, WEBP · review before save</p>
        <input
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={ocrLoading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleOcrUpload(file);
            event.currentTarget.value = "";
          }}
        />
      </label>
      </div>

      {ocrRows.length > 0 && (
        <Card className="glass-card border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base font-display">Review OCR import</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{ocrRows.length} rows found in {ocrFileName}. Nothing is saved until you confirm.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setOcrRows([])}>Discard</Button>
                <Button size="sm" onClick={saveOcrRows}>Save {ocrRows.length} rows</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-h-72 overflow-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border/30 text-muted-foreground"><th className="text-left py-2">Date</th><th className="text-left py-2">Description</th><th className="text-left py-2">Category</th><th className="text-right py-2">Amount</th></tr></thead>
                <tbody>{ocrRows.map((row) => <tr key={row.id} className="border-b border-border/20"><td className="py-2 text-muted-foreground">{row.date}</td><td className="py-2">{row.description}</td><td className="py-2">{row.category}</td><td className="py-2 text-right">{fmt(row.amount, { signed: true })}</td></tr>)}</tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters & Export */}
      <Card className="glass-card border-border/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base font-display">Recent Transactions</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-40 md:w-52 h-9"
                />
              </div>
              <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => exportData("csv")} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportData("json")} className="gap-1.5">
                <FileText className="w-3.5 h-3.5" /> JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No transactions yet. Add one to get started!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left py-2.5 font-medium">Date</th>
                    <th className="text-left py-2.5 font-medium">Description</th>
                    <th className="text-left py-2.5 font-medium">Category</th>
                    <th className="text-right py-2.5 font-medium">Amount</th>
                    <th className="text-right py-2.5 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((tx) => (
                    <tr key={tx.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                      <td className="py-3 text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="py-3 font-medium">{tx.description}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground">
                          {tx.category}
                        </span>
                      </td>
                      <td className={`py-3 text-right font-display font-semibold ${
                        tx.amount > 0 ? "text-primary" : "text-destructive"
                      }`}>
                        {fmt(tx.amount, { signed: true })}
                      </td>
                      <td className="py-3 text-right">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(tx.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Transactions;
