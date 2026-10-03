import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOrderDataState } from "@/lib/orderDataState";

export function OrderDataStatus({
  loading,
  error,
  hasLoaded,
  connectionLost = false,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  connectionLost?: boolean;
  onRetry: () => void;
}) {
  const state = getOrderDataState({ loading, error, hasLoaded, connectionLost });
  if (state === "ready" && !loading) return null;
  if (state === "loading" || (state === "ready" && loading)) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border bg-background p-4 text-sm text-muted-foreground"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {hasLoaded ? "Refreshing orders…" : "Loading orders…"}
      </div>
    );
  }
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-semibold">
          {state === "unavailable" ? "Orders unavailable" : "Orders may be out of date"}
        </p>
        <p className="mt-1 break-words">
          {error ?? "Realtime updates are disconnected."}{" "}
          {state === "stale"
            ? "Showing the last loaded orders. Refresh before acting."
            : "We could not load orders. This does not mean there are no orders."}
        </p>
      </div>
      <Button variant="outline" className="min-h-11" disabled={loading} onClick={onRetry}>
        <RefreshCw className={loading ? "animate-spin" : ""} />
        {loading ? "Retrying…" : "Retry"}
      </Button>
    </div>
  );
}
