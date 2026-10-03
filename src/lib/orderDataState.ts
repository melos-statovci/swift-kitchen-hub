export type OrderDataState = "loading" | "unavailable" | "stale" | "ready";

export function getOrderDataState({
  loading,
  error,
  hasLoaded,
  connectionLost = false,
}: {
  loading: boolean;
  error: string | null;
  hasLoaded: boolean;
  connectionLost?: boolean;
}): OrderDataState {
  if (!hasLoaded) return error ? "unavailable" : "loading";
  if (error || connectionLost) return "stale";
  return "ready";
}
