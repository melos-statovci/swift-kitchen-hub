import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOrders } from "@/hooks/useOrders";
import type { Order } from "@/lib/types";
import { KitchenCard } from "@/components/kitchen/KitchenCard";
import { OrderDataStatus } from "@/components/OrderDataStatus";
import { WorkflowStageNav } from "@/components/WorkflowStageNav";
import { cn } from "@/lib/utils";

import { RequireRole } from "@/components/RequireRole";

export const Route = createFileRoute("/_authenticated/kitchen")({
  component: () => (
    <RequireRole route="kitchen">
      <KitchenDashboard />
    </RequireRole>
  ),
});

type ColumnKey = "todo" | "progress" | "done";

const COLUMNS: { key: ColumnKey; title: string; accent: string }[] = [
  { key: "todo", title: "To Do", accent: "" },
  { key: "progress", title: "In Progress", accent: "text-amber-600" },
  { key: "done", title: "Done", accent: "text-emerald-600" },
];

function KitchenDashboard() {
  const {
    orders,
    kitchenTodoOrders,
    kitchenInProgressOrders,
    kitchenDoneOrders,
    startOrder,
    markKitchenOrderReady,
    moveKitchenOrderBackward,
    loading,
    error,
    hasLoaded,
    refreshOrders,
    connectionLost,
    isOrderPending,
  } = useOrders();
  const [pendingDoneId, setPendingDoneId] = useState<string | null>(null);
  const laneRefs = useRef<Record<ColumnKey, HTMLDivElement | null>>({
    todo: null,
    progress: null,
    done: null,
  });

  const buckets: Record<ColumnKey, Order[]> = {
    todo: kitchenTodoOrders,
    progress: kitchenInProgressOrders,
    done: kitchenDoneOrders,
  };

  const handleStart = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (order?.status === "ACCEPTED" && !isOrderPending(id)) startOrder(id);
  };

  const handleMarkReady = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (order?.status === "IN_PROGRESS" && !isOrderPending(id)) setPendingDoneId(id);
  };

  const handleMoveBack = (id: string) => {
    const order = orders.find((o) => o.id === id);
    if ((order?.status === "IN_PROGRESS" || order?.status === "READY") && !isOrderPending(id)) {
      moveKitchenOrderBackward(id);
    }
  };

  const confirmDone = () => {
    const order = orders.find((o) => o.id === pendingDoneId);
    if (order?.status === "IN_PROGRESS" && !isOrderPending(order.id)) {
      markKitchenOrderReady(order.id);
    }
    setPendingDoneId(null);
  };

  const pendingOrder = pendingDoneId ? orders.find((o) => o.id === pendingDoneId) : null;

  return (
    <div className="flex min-w-0 flex-col lg:h-[calc(100dvh-7rem)] lg:min-h-[24rem]">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Kitchen</h1>
        <p className="text-sm text-muted-foreground">
          Preparation notes, quantities, and sizes. Oldest placed first.
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
        <>
          <div className="mb-3">
            <WorkflowStageNav
              stages={COLUMNS.map((column) => ({
                id: column.key,
                label: column.title,
                count: buckets[column.key].length,
              }))}
              onSelect={(id) =>
                laneRefs.current[id as ColumnKey]?.scrollIntoView({
                  behavior: "smooth",
                  block: "nearest",
                  inline: "start",
                })
              }
            />
          </div>

          <div className="min-h-0 min-w-0 flex-1 snap-x snap-proximity overflow-x-auto overscroll-x-contain lg:snap-none">
            <div className="grid h-full grid-flow-col auto-cols-[calc(100%-2.5rem)] gap-3 md:auto-cols-[minmax(19rem,calc(50%-0.375rem))] lg:min-w-[820px] lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-3">
              {COLUMNS.map((col) => {
                const items = buckets[col.key];
                return (
                  <div
                    key={col.key}
                    ref={(element) => {
                      laneRefs.current[col.key] = element;
                    }}
                    className="flex min-h-0 min-w-0 snap-start flex-col rounded-lg border border-border bg-muted/30"
                  >
                    <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
                      <div className="flex items-center gap-2">
                        <h2 className={cn("text-base font-semibold tracking-tight", col.accent)}>
                          {col.title}
                        </h2>
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-sm font-semibold tabular-nums text-muted-foreground">
                          {items.length}
                        </span>
                      </div>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2.5 p-2.5 lg:overflow-y-auto">
                      {items.length === 0 ? (
                        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                          No orders in {col.title.toLowerCase()}
                        </div>
                      ) : (
                        <AnimatePresence mode="popLayout">
                          {items.map((order) => (
                            <KitchenCard
                              key={order.id}
                              order={order}
                              pending={isOrderPending(order.id)}
                              onStart={handleStart}
                              onMarkReady={handleMarkReady}
                              onMoveBack={handleMoveBack}
                            />
                          ))}
                        </AnimatePresence>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <Dialog open={pendingDoneId !== null} onOpenChange={(v) => !v && setPendingDoneId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Is order {pendingOrder ? `#${pendingOrder.orderNumber}` : ""} done?
            </DialogTitle>
            <DialogDescription>Mark this order as ready for pickup or delivery.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDoneId(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDone}
              disabled={!pendingOrder || isOrderPending(pendingOrder.id)}
            >
              Yes, it's done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
