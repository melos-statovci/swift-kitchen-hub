import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequireRole } from "@/components/RequireRole";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  useArchive,
  ARCHIVE_STATUS_DISPLAY,
  type ArchiveFilters,
  type ArchiveStatusFilter,
  type ArchiveWindow,
  type Order,
} from "@/hooks/useArchive";

export const Route = createFileRoute("/_authenticated/archive")({
  component: () => (
    // Setting route="acceptance" lets BOTH admin (via canAccess admin override)
    // AND acceptance role through. Kitchen and driver are denied.
    <RequireRole route="acceptance">
      <ArchivePage />
    </RequireRole>
  ),
});

function ArchivePage() {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ArchiveStatusFilter>("all");
  const [window, setWindow] = useState<ArchiveWindow>("7d");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Debounce search input — typing fires fetches otherwise
  useEffect(() => {
    const t = globalThis.setTimeout(() => setQuery(searchInput), 250);
    return () => globalThis.clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo<ArchiveFilters>(
    () => ({ status, window, query }),
    [status, window, query],
  );

  const { orders, total, hasMore, loading, loadingMore, error, loadMore } = useArchive(filters);

  const clearSearch = () => {
    setSearchInput("");
    setQuery("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order archive</h1>
          <p className="text-sm text-muted-foreground">
            Past delivered, cancelled, and declined orders.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by order #, name, or phone"
            className="pl-9 pr-9"
            aria-label="Search archive"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v as ArchiveStatusFilter)}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
            <SelectItem value="DECLINED">Declined</SelectItem>
          </SelectContent>
        </Select>

        <Select value={window} onValueChange={(v) => setWindow(v as ArchiveWindow)}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filter by time window">
            <SelectValue placeholder="Time window" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading archive…</p>
        </div>
      ) : error ? (
        <div className="text-center py-20 text-destructive">{error}</div>
      ) : orders.length === 0 ? (
        <EmptyState query={query} status={status} window={window} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Showing {orders.length} of {total} {total === 1 ? "order" : "orders"}.
          </p>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Placed</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <ArchiveRow
                    key={order.id}
                    order={order}
                    expanded={expanded === order.id}
                    onToggleExpand={() =>
                      setExpanded((prev) => (prev === order.id ? null : order.id))
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button onClick={loadMore} disabled={loadingMore} variant="outline">
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ArchiveRow({
  order,
  expanded,
  onToggleExpand,
}: {
  order: Order;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const statusInfo = ARCHIVE_STATUS_DISPLAY[order.status as keyof typeof ARCHIVE_STATUS_DISPLAY];

  return (
    <>
      <TableRow>
        <TableCell className="font-mono text-xs">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-left text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-label={`${expanded ? "Hide" : "View"} details for order ${order.orderNumber}`}
            onClick={onToggleExpand}
          >
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
            {order.orderNumber}
          </button>
        </TableCell>
        <TableCell className="font-medium">{order.customerName}</TableCell>
        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
          {order.customerPhone}
        </TableCell>
        <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
          {formatDateTime(order.placedAt)}
        </TableCell>
        <TableCell className="text-right font-medium">{formatCurrency(order.total)}</TableCell>
        <TableCell>
          {statusInfo && (
            <Badge
              variant={
                statusInfo.tone === "success"
                  ? "default"
                  : statusInfo.tone === "danger"
                    ? "destructive"
                    : "secondary"
              }
            >
              {statusInfo.label}
            </Badge>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={6} className="py-4">
            <ArchiveOrderDetails order={order} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function ArchiveOrderDetails({ order }: { order: Order }) {
  return (
    <div className="space-y-3 px-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
            {order.fulfillmentType === "PICKUP" ? "Pickup" : "Delivery"}
          </p>
          <FulfillmentBadge fulfillmentType={order.fulfillmentType} />
          <p className="mt-2 md:hidden">
            <span className="text-muted-foreground">Phone: </span>
            <a
              className="break-all underline-offset-2 hover:underline"
              href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`}
            >
              {order.customerPhone}
            </a>
          </p>
          {order.customerAddress && <p className="mt-1">{order.customerAddress}</p>}
          {order.customerNotes && (
            <p className="text-muted-foreground text-xs mt-1">Notes: {order.customerNotes}</p>
          )}
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Timeline</p>
          <p className="text-xs">Placed: {formatDateTime(order.placedAt)}</p>
          {order.acceptedAt && (
            <p className="text-xs">Accepted: {formatDateTime(order.acceptedAt)}</p>
          )}
          {order.deliveredAt && (
            <p className="text-xs">Delivered: {formatDateTime(order.deliveredAt)}</p>
          )}
          {order.cancelledAt && (
            <p className="text-xs">Cancelled: {formatDateTime(order.cancelledAt)}</p>
          )}
          {order.declinedAt && (
            <p className="text-xs">Declined: {formatDateTime(order.declinedAt)}</p>
          )}
        </div>
      </div>

      {order.declineReason && (
        <div className="bg-destructive/5 border border-destructive/20 rounded p-3 text-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Decline reason
          </p>
          <p>{order.declineReason}</p>
        </div>
      )}

      <div>
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Items</p>
        <div className="space-y-1.5">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 text-sm border-b border-border/40 pb-1.5 last:border-b-0"
            >
              <div className="flex-1">
                <span className="font-medium">
                  {item.quantity}× {item.nameSnapshot}
                </span>
                {item.variantNameSnapshot && (
                  <span className="block text-xs font-medium text-muted-foreground">
                    {item.variantNameSnapshot}
                  </span>
                )}
                {item.notes && (
                  <span className="text-muted-foreground text-xs ml-2">({item.notes})</span>
                )}
              </div>
              <span className="font-mono">
                {formatCurrency(item.priceSnapshot * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-2 pt-2 space-y-0.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Delivery</span>
            <span>{formatCurrency(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(order.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  query,
  status,
  window,
}: {
  query: string;
  status: ArchiveStatusFilter;
  window: ArchiveWindow;
}) {
  const hasFilters = query || status !== "all" || window !== "7d";
  return (
    <div className="text-center py-16 text-muted-foreground">
      <p className="text-sm">
        {hasFilters ? "No orders match your filters." : "No orders in the archive yet."}
      </p>
      {hasFilters && (
        <p className="text-xs mt-1">Try widening the time range or clearing search.</p>
      )}
    </div>
  );
}
