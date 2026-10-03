import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { MapPin, Phone, StickyNote, PackageCheck, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { OrderDataStatus } from "@/components/OrderDataStatus";
import { RequireRole } from "@/components/RequireRole";
import { useOrders } from "@/hooks/useOrders";
import { formatCurrency } from "@/lib/format";
import { AgeBadge } from "@/components/AgeBadge";
import { minutesInStatus, ageLevelFor, AGE_BORDER } from "@/lib/orderAge";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/driver")({
  component: () => (
    <RequireRole route="driver">
      <DriverDashboard />
    </RequireRole>
  ),
});

function DriverDashboard() {
  const {
    driverAvailableOrders,
    driverMineOrders,
    claimOrder,
    releaseOrder,
    takeOrder,
    markDelivered,
    loading,
    error,
    hasLoaded,
    refreshOrders,
    connectionLost,
    isOrderPending,
  } = useOrders();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const pendingOrder = pendingId
    ? (driverMineOrders.find((order) => order.id === pendingId) ?? null)
    : null;

  const confirmDeliver = () => {
    if (pendingOrder?.status === "OUT_FOR_DELIVERY" && !isOrderPending(pendingOrder.id)) {
      markDelivered(pendingOrder.id, true);
    }
    setPendingId(null);
  };

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Claim, take out, and complete delivery orders.
        </p>
      </div>

      <OrderDataStatus
        loading={loading}
        error={error}
        hasLoaded={hasLoaded}
        connectionLost={connectionLost}
        onRetry={refreshOrders}
      />

      {hasLoaded && (
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2 lg:gap-5">
          <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30">
            <h2 className="border-b border-border bg-background px-4 py-3 text-base font-semibold">
              Your deliveries{" "}
              <span className="ml-1 text-muted-foreground">{driverMineOrders.length}</span>
            </h2>
            <div className="p-2.5">
              {driverMineOrders.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing claimed yet. Choose a delivery from Available.
                </p>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {driverMineOrders.map((order) => (
                      <DeliveryCard
                        key={order.id}
                        order={order}
                        assigned
                        footer={
                          order.status === "READY" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                className="min-h-11 min-w-0 flex-1"
                                disabled={isOrderPending(order.id)}
                                onClick={() => takeOrder(order.id)}
                              >
                                Out for delivery
                              </Button>
                              <Button
                                variant="outline"
                                className="min-h-11 min-w-0 flex-1"
                                disabled={isOrderPending(order.id)}
                                onClick={() => releaseOrder(order.id)}
                              >
                                Release
                              </Button>
                            </div>
                          ) : order.status === "OUT_FOR_DELIVERY" ? (
                            <Button
                              className="min-h-11 w-full"
                              disabled={isOrderPending(order.id)}
                              onClick={() => setPendingId(order.id)}
                            >
                              Mark delivered
                            </Button>
                          ) : null
                        }
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-muted/30">
            <h2 className="border-b border-border bg-background px-4 py-3 text-base font-semibold">
              Available{" "}
              <span className="ml-1 text-muted-foreground">{driverAvailableOrders.length}</span>
            </h2>
            <div className="p-2.5">
              {driverAvailableOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background px-6 py-10 text-center">
                  <PackageCheck className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
                  <div className="text-sm font-medium">Nothing waiting</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    New ready orders will appear here to claim.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {driverAvailableOrders.map((order) => (
                      <DeliveryCard
                        key={order.id}
                        order={order}
                        assigned={false}
                        footer={
                          <Button
                            className="min-h-11 w-full"
                            disabled={isOrderPending(order.id)}
                            onClick={() => claimOrder(order.id)}
                          >
                            Claim delivery
                          </Button>
                        }
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      <Dialog open={pendingId !== null} onOpenChange={(open) => !open && setPendingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirm order {pendingOrder ? `#${pendingOrder.orderNumber}` : ""} delivered?
            </DialogTitle>
            <DialogDescription>
              This will mark the order as delivered and notify the customer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingId(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDeliver}
              disabled={!pendingOrder || isOrderPending(pendingOrder.id)}
            >
              Yes, delivered
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeliveryCard({
  order,
  assigned,
  footer,
}: {
  order: Order;
  assigned: boolean;
  footer: React.ReactNode;
}) {
  const [itemsOpen, setItemsOpen] = useState(false);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const mapsUrl = order.customerAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(order.customerAddress)}`
    : null;
  const telHref = `tel:${order.customerPhone.replace(/[^+\d]/g, "")}`;
  const minutes = minutesInStatus(order);
  const ageLevel = minutes !== null ? ageLevelFor(minutes) : null;
  const ageLabel = order.status === "OUT_FOR_DELIVERY" ? "on road" : "ready";

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
    >
      <Card
        className={cn(
          "min-w-0 gap-0 overflow-hidden p-0",
          ageLevel && "border-l-4",
          ageLevel && AGE_BORDER[ageLevel],
        )}
      >
        <div className="min-w-0 space-y-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight">#{order.orderNumber}</h3>
              {minutes !== null && <AgeBadge minutes={minutes} />}
            </div>
            <span
              className={cn(
                "rounded-md px-2 py-1 text-xs font-semibold",
                assigned
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
              )}
            >
              {assigned ? "Your trip" : "Unassigned"}
            </span>
          </div>
          <div className="flex flex-wrap justify-between gap-x-3 text-sm text-muted-foreground">
            <span>{minutes !== null ? `${minutes} min ${ageLabel}` : ageLabel}</span>
            <span className="font-semibold tabular-nums">{formatCurrency(order.total)}</span>
          </div>

          <div className="space-y-1 text-sm">
            <div className="break-words text-base font-semibold">{order.customerName}</div>
            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-words">
                {order.customerAddress || "Address unavailable"}
              </span>
            </div>
            <div className="flex items-start gap-2 text-muted-foreground">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 break-all">{order.customerPhone}</span>
            </div>
          </div>

          {order.customerNotes && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100">
              <StickyNote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="min-w-0 break-words">
                <span className="block text-xs font-bold uppercase tracking-wide">Order note</span>
                {order.customerNotes}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <a
              href={telHref}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-accent"
            >
              Call
            </a>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold hover:bg-accent"
              >
                Open map
              </a>
            )}
          </div>

          <div className="border-t border-border pt-2">
            <button
              type="button"
              onClick={() => setItemsOpen((open) => !open)}
              aria-expanded={itemsOpen}
              className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {itemsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {order.items.length} line{order.items.length === 1 ? "" : "s"} · {itemCount} item
              {itemCount === 1 ? "" : "s"} — {itemsOpen ? "Hide items" : "View items"}
            </button>
            {itemsOpen && (
              <ul className="space-y-2 rounded-md bg-muted/40 p-3 text-sm">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="min-w-0 border-b border-border/60 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words font-medium">
                        <span className="tabular-nums">{item.quantity} ×</span> {item.nameSnapshot}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatCurrency(item.priceSnapshot * item.quantity)}
                      </span>
                    </div>
                    {item.variantNameSnapshot && (
                      <div className="mt-0.5 break-words text-muted-foreground">
                        {item.variantNameSnapshot}
                      </div>
                    )}
                    {item.notes && <div className="mt-0.5 break-words">↳ {item.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {footer && <div className="border-t border-border bg-background p-2.5">{footer}</div>}
      </Card>
    </motion.li>
  );
}
