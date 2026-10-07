import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TransactionFeedNoticeProps {
  warning?: string;
}

export function TransactionFeedNotice({ warning }: TransactionFeedNoticeProps) {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching({ queryKey: ["transactions"] }) > 0;

  if (!warning) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between" role="status">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-medium">{warning}</p>
          <p className="mt-1 text-warning/80">In Google Sheets, choose Share and give Viewer access to the Google account connected in Lovable. Then recheck access here.</p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 border-warning/30 text-warning hover:bg-warning/10 hover:text-warning"
        disabled={isFetching}
        onClick={() => queryClient.invalidateQueries({ queryKey: ["transactions"] })}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        {isFetching ? "Checking…" : "Recheck access"}
      </Button>
    </div>
  );
}