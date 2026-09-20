import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive } from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import { KanbanColumn } from "@/components/acceptance/KanbanColumn";
import { OrderCard } from "@/components/acceptance/OrderCard";
import { DeclineDialog } from "@/components/acceptance/DeclineDialog";
import { ConfirmDialog } from "@/components/acceptance/ConfirmDialog";

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
  } = useOrders();
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });

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
    <div className="flex h-[calc(100vh-7rem)] flex-col">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Acceptance</h1>
          <p className="text-sm text-muted-foreground">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KanbanColumn title="Pending" count={pendingOrders.length} pulseWhenActive>
          {pendingOrders.map((o) => (
            <OrderCard key={o.id} order={o} onAccept={acceptOrder} onDecline={handleDecline} />
          ))}
        </KanbanColumn>
        <KanbanColumn title="Accepted" count={acceptanceAcceptedOrders.length}>
          {acceptanceAcceptedOrders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </KanbanColumn>
        <KanbanColumn title="Ready" count={readyOrders.length}>
          {readyOrders.map((o) => (
            <OrderCard
              key={o.id}
              order={o}
              onDispatch={handleDispatchOpen}
              onPickup={handlePickupOpen}
            />
          ))}
        </KanbanColumn>
        <KanbanColumn title="Out for Delivery" count={outForDeliveryOrders.length}>
          {outForDeliveryOrders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </KanbanColumn>
      </div>

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
