import { useState } from "react";
import { AlertCircle, Clock3, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TransactionLoadResult } from "@/lib/transactions";
import { supabase } from "@/integrations/supabase/client";

interface GoogleSheetsStatusProps {
  feed?: TransactionLoadResult;
  isLoading?: boolean;
}

interface ErrorExplanation {
  likelyCause: string;
  recoverySteps: string[];
}

function formatReadTime(value: string | null | undefined) {
  if (!value) return "No successful read recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "No successful read recorded";
  return date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function sourceDescription(feed?: TransactionLoadResult, isLoading?: boolean) {
  if (isLoading || !feed) return "Checking transaction source";
  if (feed.sheetCount > 0 && feed.localCount > 0) return "Google Sheets and local imports";
  if (feed.sheetCount > 0) return "Google Sheets data";
  if (feed.localCount > 0) return "locally imported transactions";
  if (feed.warning) return "No transaction data available";
  return "No transactions yet";
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unable to explain that error. Please try again.";
}

export function GoogleSheetsStatus({ feed, isLoading }: GoogleSheetsStatusProps) {
  const [open, setOpen] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [explanation, setExplanation] = useState<ErrorExplanation | null>(null);
  const [requestError, setRequestError] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [blockedStatus, setBlockedStatus] = useState<number | null>(null);

  const explainError = async (acknowledgeRecovery = false) => {
    const cleanedError = errorText.trim();
    if (!cleanedError) {
      setRequestError("Paste the Google Sheets error message first.");
      return;
    }

    setIsExplaining(true);
    setRequestError("");
    setExplanation(null);
    if (acknowledgeRecovery) setBlockedStatus(null);
    try {
      const { data, error } = await supabase.functions.invoke("sheets-error-explainer", {
        body: { error: cleanedError, acknowledgeRecovery },
      });
      if (error) {
        const context = (error as { context?: unknown }).context;
        if (context instanceof Response) {
          const body = await context.clone().json().catch(() => null);
          throw Object.assign(new Error(typeof body?.error === "string" ? body.error : error.message), {
            status: context.status,
            refusal: body?.refusal === true,
            paused: body?.paused === true,
          });
        }
        throw error;
      }
      if (!data || typeof data.likelyCause !== "string" || !Array.isArray(data.recoverySteps)) {
        throw new Error("The explanation could not be read. Please try again.");
      }
      setExplanation({ likelyCause: data.likelyCause, recoverySteps: data.recoverySteps });
      setBlockedStatus(null);
    } catch (error) {
      setRequestError(errorMessage(error));
      const status = Number((error as { status?: number })?.status);
      if ((status === 402 || status === 403) && !(error as { refusal?: boolean })?.refusal && (error as { paused?: boolean })?.paused) setBlockedStatus(status);
    } finally {
      setIsExplaining(false);
    }
  };

  const prefillError = () => {
    setErrorText(feed?.warning ?? "");
    setRequestError("");
    setExplanation(null);
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border/50 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Transaction data status">
      <div className="space-y-2">
        <p className="text-sm font-medium">Totals use {sourceDescription(feed, isLoading)}</p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span>Last successful Sheets read: {formatReadTime(feed?.lastSuccessfulSheetsReadAt)}</span>
        </p>
        {feed?.warning && (
          <p className="flex items-center gap-2 text-xs text-warning">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Sheets is unavailable; local-only totals may be incomplete or stale.</span>
          </p>
        )}
      </div>
      <Dialog open={open} onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) prefillError();
      }}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="shrink-0" aria-label="Explain a Google Sheets error">
            <Sparkles className="h-4 w-4" />
            Explain an error
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Google Sheets error</DialogTitle>
            <DialogDescription>
              Paste the error for a likely cause and safe recovery steps. Your text is sent to the AI service and is not saved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="sheets-error-text">Error message</Label>
            <Textarea
              id="sheets-error-text"
              value={errorText}
              onChange={(event) => {
                setErrorText(event.target.value.slice(0, 3000));
                setRequestError("");
              }}
              placeholder="For example: 403 PERMISSION_DENIED"
              maxLength={3000}
              className="min-h-28 resize-y"
            />
            <p className="text-xs text-muted-foreground">Remove account details, spreadsheet links, access tokens, or private sheet contents before sending.</p>
            {blockedStatus && (
              <p className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning" role="status">
                AI access is paused after a {blockedStatus} response. Ask your workspace owner to restore access first. Only retry after they confirm it is restored.
              </p>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={() => explainError()} disabled={isExplaining || !errorText.trim() || blockedStatus !== null}>
                {isExplaining ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                {isExplaining ? "Reviewing…" : "Explain error"}
              </Button>
            </div>
            {blockedStatus && (
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => explainError(true)} disabled={isExplaining || !errorText.trim()}>
                  {isExplaining ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                  {isExplaining ? "Checking access…" : "Access restored — try again"}
                </Button>
              </div>
            )}
          </div>
          {requestError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{requestError}</p>
            </div>
          )}
          {explanation && (
            <div className="space-y-3 border-t border-border pt-4" aria-live="polite">
              <div>
                <h3 className="text-sm font-semibold">Likely cause</h3>
                <p className="mt-1 text-sm text-muted-foreground">{explanation.likelyCause}</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Safe recovery steps</h3>
                <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                  {explanation.recoverySteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}
                </ol>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}