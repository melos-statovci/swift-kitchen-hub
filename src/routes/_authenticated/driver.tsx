import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, MapPin, StickyNote, ChevronDown, ChevronUp, PackageCheck } from "lucide-react";
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
import { useOrders } from "@/hooks/useOrders";
import { formatCurrency } from "@/lib/format";
import { AgeBadge } from "@/components/AgeBadge";
import { minutesInStatus, ageLevelFor, AGE_BORDER } from "@/lib/orderAge";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { RequireRole } from "@/components/RequireRole";

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
  } = useOrders();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, force] = useState(0);

  // re-render every 30s to keep ages fresh
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const pendingOrder = pendingId
    ? (driverMineOrders.find((o) => o.id === pendingId) ?? null)
    : null;

  const confirmDeliver = () => {
    if (!pendingId) return;
    markDelivered(pendingId, true);
    setPendingId(null);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Claim a ready order, then take it out and mark it delivered.
        </p>
      </div>

      {/* Mine */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your deliveries ({driverMineOrders.length})
        </h2>
        {driverMineOrders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing claimed yet. Grab one from below.
          </p>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence mode="popLayout">
              {driverMineOrders.map((order) => (
                <DeliveryCard
                  key={order.id}
                  order={order}
                  footer={
                    order.status === "READY" ? (
                      <div className="flex gap-2">
                        <Button
                          className="h-12 flex-1 text-base"
                          onClick={() => takeOrder(order.id)}
                        >
                          Out for delivery
                        </Button>
                        <Button
                          variant="outline"
                          className="h-12"
                          onClick={() => releaseOrder(order.id)}
                        >
                          Release
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="lg"
                        className="h-12 w-full text-base"
                        onClick={() => setPendingId(order.id)}
                      >
                        Mark Delivered
                      </Button>
                    )
                  }
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      {/* Available */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Available ({driverAvailableOrders.length})
        </h2>
        {driverAvailableOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <PackageCheck className="mb-3 h-10 w-10 text-muted-foreground" aria-hidden />
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
                  footer={
                    <Button
                      size="lg"
                      className="h-12 w-full text-base"
                      onClick={() => claimOrder(order.id)}
                    >
                      Claim
                    </Button>
                  }
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <Dialog open={pendingId !== null} onOpenChange={(v) => !v && setPendingId(null)}>
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
            <Button onClick={confirmDeliver}>Yes, delivered</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for delivery",
};

function DeliveryCard({ order, footer }: { order: Order; footer: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const itemCount = order.items.reduce((s, it) => s + it.quantity, 0);
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(order.customerAddress ?? "")}`;
  const telHref = `tel:${order.customerPhone.replace(/[^+\d]/g, "")}`;
  const minutes = minutesInStatus(order);
  const ageLevel = minutes !== null ? ageLevelFor(minutes) : null;

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
          "overflow-hidden p-0 gap-0",
          ageLevel && "border-l-4",
          ageLevel && AGE_BORDER[ageLevel],
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-4 py-4 text-left transition-colors hover:bg-muted/40"
          aria-expanded={expanded}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tracking-tight">#{order.orderNumber}</span>
                {minutes !== null && <AgeBadge minutes={minutes} />}
                <span className="text-xs text-muted-foreground">
                  {STATUS_LABEL[order.status] ?? order.status}
                </span>
              </div>
              <div className="mt-1 truncate text-sm font-medium">{order.customerName}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {itemCount} item{itemCount === 1 ? "" : "s"} · {formatCurrency(order.total)}
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="space-y-3 border-t border-border bg-muted/20 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={telHref}
                className="flex flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-accent"
              >
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{order.customerPhone}</span>
              </a>
              {order.customerAddress && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-start gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="line-clamp-2 text-left">{order.customerAddress}</span>
                </a>
              )}
            </div>

            {order.customerNotes && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{order.customerNotes}</span>
              </div>
            )}

            <ul className="space-y-1 rounded-md bg-background/60 p-3 text-sm">
              {order.items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3">
                  <span>
                    <span>
                      <span className="font-medium tabular-nums">{it.quantity}</span> ×{" "}
                      {it.nameSnapshot}
                    </span>
                    {it.variantNameSnapshot && (
                      <span className="block pl-5 text-xs font-medium text-muted-foreground">
                        {it.variantNameSnapshot}
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatCurrency(it.priceSnapshot * it.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="border-t border-border bg-background p-3">{footer}</div>
      </Card>
    </motion.li>
  );
}
