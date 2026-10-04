import { useCallback, useEffect, useState } from "react";
import type { Order, OrderStatus } from "@/lib/types";
import { apiFetch, ApiError, NetworkError } from "@/lib/api";

export type ArchiveStatus = "DELIVERED" | "CANCELLED" | "DECLINED";
export type ArchiveStatusFilter = "all" | ArchiveStatus;

export type ArchiveWindow = "7d" | "30d" | "90d" | "all";

export type ArchiveFilters = {
  status: ArchiveStatusFilter;
  window: ArchiveWindow;
  query: string;
};

type ArchiveResponse = {
  orders: Order[];
  total: number;
  hasMore: boolean;
};

const PAGE_SIZE = 50;

// "Last N days" is a rolling N×24-hour duration, not a business-calendar-day filter.
export function windowToFromDate(window: ArchiveWindow, now: number = Date.now()): Date | null {
  switch (window) {
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now - 90 * 24 * 60 * 60 * 1000);
    case "all":
      // The backend defaults to 7 days, so send the earliest supported order instant.
      return new Date(0);
  }
}

function buildSearchParams(filters: ArchiveFilters, offset: number): string {
  const params = new URLSearchParams();
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  const fromDate = windowToFromDate(filters.window);
  if (fromDate) params.set("from", fromDate.toISOString());
  if (filters.query.trim()) params.set("q", filters.query.trim());
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String(offset));
  return params.toString();
}

export function useArchive(filters: ArchiveFilters) {
  const { status, window: archiveWindow, query } = filters;
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-fetch from scratch when filters change
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    setLoading(true);
    setError(null);

    apiFetch<ArchiveResponse>(
      `/api/orders/archive?${buildSearchParams({ status, window: archiveWindow, query }, 0)}`,
      {
        auth: true,
        signal: ac.signal,
      },
    )
      .then((data) => {
        if (cancelled) return;
        setOrders(data.orders);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || ac.signal.aborted) return;
        if (err instanceof NetworkError) setError("Could not reach the server.");
        else if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load archive.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [status, archiveWindow, query]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await apiFetch<ArchiveResponse>(
        `/api/orders/archive?${buildSearchParams(filters, orders.length)}`,
        { auth: true },
      );
      setOrders((prev) => [...prev, ...data.orders]);
      setHasMore(data.hasMore);
      setTotal(data.total);
    } catch (err) {
      if (err instanceof NetworkError) setError("Could not load more.");
      else if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load more.");
    } finally {
      setLoadingMore(false);
    }
  }, [filters, orders.length, hasMore, loadingMore]);

  return {
    orders,
    total,
    hasMore,
    loading,
    loadingMore,
    error,
    loadMore,
  };
}

// Status copy for display (same shape used elsewhere, kept local to avoid import dance)
export const ARCHIVE_STATUS_DISPLAY: Record<
  ArchiveStatus,
  { label: string; tone: "success" | "danger" | "warning" }
> = {
  DELIVERED: { label: "Delivered", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "warning" },
  DECLINED: { label: "Declined", tone: "danger" },
};

export type { Order, OrderStatus };
