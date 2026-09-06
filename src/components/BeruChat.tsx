import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Sparkles, LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { loadTransactions } from "@/lib/transactions";

interface Msg {
  role: "user" | "assistant" | "system";
  content: string;
  escalated?: boolean;
}

const GREETING: Msg = {
  role: "assistant",
  content:
    "Hi, I'm Beru — your SmartSpend assistant. Ask me about your spending, budgets, or how to use the app. If I can't help, I'll escalate to the team.",
};

export function BeruChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: transactionFeed } = useQuery({
    queryKey: ["transactions"],
    queryFn: loadTransactions,
  });
  const transactions = transactionFeed?.transactions ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const buildContext = () => {
    const income = transactions.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
    const expenses = transactions.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
    const byCat: Record<string, number> = {};
    transactions.filter((t: any) => t.type === "expense").forEach((t: any) => {
      byCat[t.category] = (byCat[t.category] || 0) + Math.abs(Number(t.amount));
    });
    const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return {
      txCount: transactions.length,
      income,
      expenses,
      balance: income - expenses,
      topCategories: topCats.map(([n, v]) => ({ category: n, total: v })),
    };
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("beru-chat", {
        body: {
          messages: next.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
          context: buildContext(),
        },
      });
      if (error) throw error;
      const reply: string = data?.reply ?? "Sorry, I couldn't get a response.";
      const escalated: boolean = !!data?.escalated;
      setMessages((m) => [...m, { role: "assistant", content: reply, escalated }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Beru is unavailable right now");
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I'm having trouble reaching the server. Please try again in a moment.", escalated: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 h-13 w-13 rounded-full bg-primary text-primary-foreground shadow-lg glow-primary flex items-center justify-center hover:scale-105 transition-transform"
        style={{ height: 52, width: 52 }}
        aria-label="Open Beru chat"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[92vw] max-w-sm h-[70vh] max-h-[560px] glass-card rounded-2xl flex flex-col overflow-hidden border border-border/60 shadow-2xl">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-gradient-to-r from-primary/10 to-accent/10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold leading-tight">Beru</p>
                <p className="text-[10px] text-muted-foreground">SmartSpend Assistant</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="w-4 h-4" />
            </Button>
          </header>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary/60 text-foreground rounded-bl-sm border border-border/30"
                  }`}
                >
                  {m.content}
                  {m.escalated && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-warning">
                      <LifeBuoy className="w-3 h-3" />
                      Escalated to support team
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-secondary/60 border border-border/30 rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0.3s]" />
                  </span>
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="border-t border-border/40 p-2 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Beru anything…"
              className="flex-1 bg-background/60 border border-border/40 rounded-full px-3 py-2 text-sm outline-none focus:border-primary/50"
              disabled={loading}
            />
            <Button type="submit" size="icon" className="h-9 w-9 rounded-full glow-primary" disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}