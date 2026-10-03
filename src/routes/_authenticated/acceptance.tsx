import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import { KanbanColumn } from "@/components/acceptance/KanbanColumn";
import { OrderCard } from "@/components/acceptance/OrderCard";
import { DeclineDialog } from "@/components/acceptance/DeclineDialog";
import { ConfirmDialog } from "@/components/acceptance/ConfirmDialog";
import { OrderDataStatus } from "@/components/OrderDataStatus";
import { WorkflowStageNav } from "@/components/WorkflowStageNav";

import { RequireRole } from "@/components/RequireRole";

export const Route = createFileRoute("/_authenticated/acceptance")({
  component: () => (
    <RequireRole route="acceptance">
      <AcceptanceDashboard />
    </RequireRole>
  ),
});

type DialogState =
  | { kind: "none" }
  | { kind: "decline"; orderId: string }
  | { kind: "dispatch"; orderId: string }
  | { kind: "pickup"; orderId: string };

function AcceptanceDashboard() {
  const {
    orders,
    pendingOrders,
    acceptanceAcceptedOrders,
    readyOrders,
    outForDeliveryOrders,
    acceptOrder,
    declineOrder,
    dispatchOrder,
    markDelivered,
    loading,
    error,
    hasLoaded,
    refreshOrders,
    connectionLost,
    isOrderPending,
  } = useOrders();
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const laneRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const stages = [
    { id: "pending", label: "Pending", count: pendingOrders.length },
    { id: "accepted", label: "Accepted", count: acceptanceAcceptedOrders.length },
    { id: "ready", label: "Ready", count: readyOrders.length },
    { id: "out-for-delivery", label: "Out for Delivery", count: outForDeliveryOrders.length },
  ];

  const activeOrder =
    dialog.kind !== "none" ? (orders.find((o) => o.id === dialog.orderId) ?? null) : null;

  const handleDecline = (id: string) => setDialog({ kind: "decline", orderId: id });
  const handleDispatchOpen = (id: string) => setDialog({ kind: "dispatch", orderId: id });
  const handlePickupOpen = (id: string) => setDialog({ kind: "pickup", orderId: id });

  const confirmDecline = (reason: string) => {
    if (dialog.kind !== "decline") return;
    declineOrder(dialog.orderId, reason || null);
  };

  const confirmDispatch = (notify: boolean) => {
    if (dialog.kind !== "dispatch") return;
    dispatchOrder(dialog.orderId, notify);
  };

  const confirmPickup = (notify: boolean) => {
    if (dialog.kind !== "pickup") return;
    markDelivered(dialog.orderId, notify);
  };

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[24rem] min-w-0 flex-col">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Acceptance</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Review incoming orders, dispatch deliveries, and complete pickups.
          </p>
        </div>
        <Link
          to="/archive"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <Archive className="h-4 w-4" aria-hidden />
          View archive
        </Link>
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
          <WorkflowStageNav
            stages={stages}
            onSelect={(id) =>
              laneRefs.current[id]?.scrollIntoView({
                behavior: "smooth",
                block: "nearest",
                inline: "start",
              })
            }
          />
          <div className="mt-3 min-h-0 min-w-0 flex-1 snap-x snap-proximity overflow-x-auto overscroll-x-contain xl:snap-none">
            <div className="grid h-full grid-flow-col auto-cols-[min(300px,calc(100%-2.5rem))] gap-3 xl:grid-flow-row xl:auto-cols-auto xl:grid-cols-4">
              <KanbanColumn
                title="Pending"
                count={pendingOrders.length}
                pulseWhenActive
                ref={(node) => {
                  laneRefs.current.pending = node;
                }}
              >
                {pendingOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    pending={isOrderPending(o.id)}
                    onAccept={acceptOrder}
                    onDecline={handleDecline}
                  />
                ))}
              </KanbanColumn>
              <KanbanColumn
                title="Accepted"
                count={acceptanceAcceptedOrders.length}
                ref={(node) => {
                  laneRefs.current.accepted = node;
                }}
              >
                {acceptanceAcceptedOrders.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </KanbanColumn>
              <KanbanColumn
                title="Ready"
                count={readyOrders.length}
                ref={(node) => {
                  laneRefs.current.ready = node;
                }}
              >
                {readyOrders.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    pending={isOrderPending(o.id)}
                    onDispatch={handleDispatchOpen}
                    onPickup={handlePickupOpen}
                  />
                ))}
              </KanbanColumn>
              <KanbanColumn
                title="Out for Delivery"
                count={outForDeliveryOrders.length}
                ref={(node) => {
                  laneRefs.current["out-for-delivery"] = node;
                }}
              >
                {outForDeliveryOrders.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </KanbanColumn>
            </div>
          </div>
        </>
      )}

      <DeclineDialog
        orderNumber={dialog.kind === "decline" ? (activeOrder?.orderNumber ?? null) : null}
        open={dialog.kind === "decline"}
        onOpenChange={(v) => !v && setDialog({ kind: "none" })}
        onConfirm={confirmDecline}
      />
      <ConfirmDialog
        mode="dispatch"
        orderNumber={dialog.kind === "dispatch" ? (activeOrder?.orderNumber ?? null) : null}
        open={dialog.kind === "dispatch"}
        onOpenChange={(v) => !v && setDialog({ kind: "none" })}
        onConfirm={confirmDispatch}
      />
      <ConfirmDialog
        mode="pickup"
        fulfillmentType={activeOrder?.fulfillmentType}
        orderNumber={dialog.kind === "pickup" ? (activeOrder?.orderNumber ?? null) : null}
        open={dialog.kind === "pickup"}
        onOpenChange={(v) => !v && setDialog({ kind: "none" })}
        onConfirm={confirmPickup}
      />
    </div>
  );
}
