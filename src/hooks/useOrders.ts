import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Order, OrderStatus } from "@/lib/types";
import { apiFetch, ApiError, NetworkError } from "@/lib/api";
import { connectSocket } from "@/lib/socket";
import { playChime } from "@/lib/sound";
import {
  createOrderActionTracker,
  mergeOrderSnapshot,
  observeOrderConnection,
} from "@/lib/orderSync";
import { isOrderVisibleToRole } from "@/lib/orderVisibility";

const sortByPlaced = (a: Order, b: Order) =>
  new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime();

const sortByDispatched = (a: Order, b: Order) => {
  const at = a.outForDeliveryAt ? new Date(a.outForDeliveryAt).getTime() : 0;
  const bt = b.outForDeliveryAt ? new Date(b.outForDeliveryAt).getTime() : 0;
  return at - bt;
};

type OrdersListResponse = { orders: Order[] };
type OrderResponse = { order: Order };

function describeError(err: unknown, fallback: string): string {
  if (err instanceof NetworkError) return err.message;
  if (err instanceof ApiError) return err.message;
  return fallback;
}

function getCurrentUser(): { id?: string; role?: string } {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem("sk_user");
  if (!raw) return {};
  try {
    return JSON.parse(raw) as { id?: string; role?: string };
  } catch {
    return {};
  }
}

function getCurrentRole(): string {
  return getCurrentUser().role ?? "admin";
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [actionTracker] = useState(createOrderActionTracker);
  const changeVersion = useRef(0);
  const orderVersions = useRef(new Map<string, number>());
  const noteChange = useCallback((id: string) => {
    changeVersion.current += 1;
    orderVersions.current.set(id, changeVersion.current);
  }, []);
  const refreshOrders = useCallback(() => setRefreshVersion((version) => version + 1), []);
  const isOrderPending = useCallback((id: string) => pendingIds.has(id), [pendingIds]);
  const beginAction = useCallback(
    (id: string) => {
      if (!actionTracker.begin(id)) return false;
      setPendingIds(actionTracker.ids());
      return true;
    },
    [actionTracker],
  );
  const endAction = useCallback(
    (id: string) => {
      const needsReconciliation = actionTracker.finish(id);
      setPendingIds(actionTracker.ids());
      if (needsReconciliation) refreshOrders();
    },
    [actionTracker, refreshOrders],
  );

  // IDs of orders currently in this role's actionable view. Used to detect a
  // *new arrival* (so we chime once per order entering the board, not on the
  // board's own forward/backward moves, which echo back over the socket).
  const knownIds = useRef<Set<string>>(new Set());

  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const requestVersion = changeVersion.current;

    setLoading(true);

    apiFetch<OrdersListResponse>("/api/orders", { auth: true, signal: ac.signal })
      .then((data) => {
        if (cancelled) return;
        const role = getCurrentRole();
        const visibleOrders = data.orders.filter((order) => isOrderVisibleToRole(order, role));
        // Preserve changes received after this snapshot request started, including
        // removals and in-flight optimistic actions. A delayed GET must not undo them.
        const protectedIds = actionTracker.ids();
        orderVersions.current.forEach((version, id) => {
          if (version > requestVersion) protectedIds.add(id);
        });
        visibleOrders.forEach((o) => {
          if (!protectedIds.has(o.id)) knownIds.current.add(o.id);
        });
        setOrders((current) => mergeOrderSnapshot(visibleOrders, current, protectedIds));
        orderVersions.current.forEach((version, id) => {
          if (version <= requestVersion) orderVersions.current.delete(id);
        });
        setHasLoaded(true);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || ac.signal.aborted) return;
        setError(describeError(err, "Failed to load orders."));
        setLoading(false);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [refreshVersion, actionTracker]);

  // -----------------------------------------------------------
  // Realtime subscription
  // -----------------------------------------------------------
  // After the initial fetch, we listen for live updates from the server.
  // The server broadcasts on any order change — accept, dispatch, etc.
  // We just merge whatever it sends into our local state.
  useEffect(() => {
    const socket = connectSocket();
    if (!socket) return;

    const role = getCurrentRole();

    const handleUpdated = (incoming: Order) => {
      actionTracker.noteServerEvent(incoming.id);
      noteChange(incoming.id);
      const isVisible = isOrderVisibleToRole(incoming, role);
      const wasKnown = knownIds.current.has(incoming.id);

      // Chime when an order *newly enters* this role's board:
      //  - kitchen: acceptance just accepted it (→ ACCEPTED)
      //  - driver:  a fresh order is ready to claim (→ READY)
      // The order's own later transitions echo back here but are already
      // known, so they don't re-chime.
      if (isVisible && !wasKnown) {
        if (
          (role === "kitchen" && incoming.status === "ACCEPTED") ||
          (role === "driver" && incoming.status === "READY")
        ) {
          playChime();
        }
      }

      // Keep the known-set in sync with what we can currently see.
      if (isVisible) knownIds.current.add(incoming.id);
      else knownIds.current.delete(incoming.id);

      setOrders((prev) => {
        const exists = prev.some((o) => o.id === incoming.id);

        // Order moved INTO a status we should see — add or replace
        if (isVisible) {
          if (exists) {
            return prev.map((o) => (o.id === incoming.id ? incoming : o));
          }
          return [...prev, incoming];
        }

        // Order moved OUT of a status we should see (e.g. DELIVERED for kitchen)
        // — remove it from our local list
        if (exists) {
          return prev.filter((o) => o.id !== incoming.id);
        }

        return prev;
      });
    };

    const handleCreated = (incoming: Order) => {
      actionTracker.noteServerEvent(incoming.id);
      noteChange(incoming.id);
      // A new order was just placed — only acceptance and admin care
      if (!isOrderVisibleToRole(incoming, role)) return;

      const wasKnown = knownIds.current.has(incoming.id);
      knownIds.current.add(incoming.id);

      // A freshly placed order lands on the acceptance (and admin) board.
      if (!wasKnown && (role === "acceptance" || role === "admin")) {
        playChime();
      }

      setOrders((prev) => {
        if (prev.some((o) => o.id === incoming.id)) return prev;
        return [...prev, incoming];
      });
    };

    const handleRemoved = ({ id }: { id: string }) => {
      actionTracker.noteServerEvent(id);
      noteChange(id);
      knownIds.current.delete(id);
      setOrders((prev) => prev.filter((order) => order.id !== id));
    };

    const stopConnectionObserver = observeOrderConnection(socket, setConnectionLost, refreshOrders);
    socket.on("order:updated", handleUpdated);
    socket.on("order:created", handleCreated);
    socket.on("order:removed", handleRemoved);

    return () => {
      stopConnectionObserver();
      socket.off("order:updated", handleUpdated);
      socket.off("order:created", handleCreated);
      socket.off("order:removed", handleRemoved);
    };
  }, [refreshOrders, noteChange, actionTracker]);

  // ---------------------------------------------------------------------
  // Local state helpers (unchanged from previous session)
  // ---------------------------------------------------------------------

  const replaceOrder = useCallback(
    (next: Order) => {
      noteChange(next.id);
      setOrders((prev) => prev.map((o) => (o.id === next.id ? next : o)));
    },
    [noteChange],
  );

  const setStatusLocal = useCallback(
    (id: string, status: OrderStatus, extra: Partial<Order> = {}) => {
      noteChange(id);
      const nowIso = new Date().toISOString();
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const next: Order = { ...o, status, ...extra };
          if (status === "ACCEPTED" && !o.acceptedAt) next.acceptedAt = nowIso;
          if (status === "IN_PROGRESS") {
            if (!o.startedAt) next.startedAt = nowIso;
            next.readyAt = null;
          }
          if (status === "READY" && !o.readyAt) next.readyAt = nowIso;
          if (status === "OUT_FOR_DELIVERY") next.outForDeliveryAt = nowIso;
          if (status === "DELIVERED") next.deliveredAt = nowIso;
          if (status === "DECLINED") next.declinedAt = nowIso;
          if (status === "CANCELLED") next.cancelledAt = nowIso;
          if (status === "ACCEPTED" && o.status === "IN_PROGRESS") {
            next.startedAt = null;
            next.readyAt = null;
          }
          return next;
        }),
      );
    },
    [noteChange],
  );

  const optimisticMutation = useCallback(
    async (
      id: string,
      optimisticStatus: OrderStatus,
      optimisticExtra: Partial<Order>,
      requestPath: string,
      body: Record<string, unknown> | undefined,
      errorFallback: string,
    ): Promise<void> => {
      const original = orders.find((o) => o.id === id);
      if (!original || !beginAction(id)) return;

      setStatusLocal(id, optimisticStatus, optimisticExtra);

      try {
        const data = await apiFetch<OrderResponse>(requestPath, {
          method: "POST",
          auth: true,
          body,
        });
        actionTracker.applyIfCurrent(id, () => replaceOrder(data.order));
      } catch (err) {
        actionTracker.applyIfCurrent(id, () => replaceOrder(original));
        toast.error(describeError(err, errorFallback));
      } finally {
        endAction(id);
      }
    },
    [orders, replaceOrder, setStatusLocal, beginAction, endAction, actionTracker],
  );

  // ---------------------------------------------------------------------
  // Mutations (unchanged from previous session)
  // ---------------------------------------------------------------------

  const acceptOrder = useCallback(
    (id: string) =>
      optimisticMutation(
        id,
        "ACCEPTED",
        {},
        `/api/orders/${id}/accept`,
        undefined,
        "Failed to accept order",
      ),
    [optimisticMutation],
  );

  const declineOrder = useCallback(
    (id: string, reason: string | null) =>
      optimisticMutation(
        id,
        "DECLINED",
        { declineReason: reason },
        `/api/orders/${id}/decline`,
        reason ? { reason } : {},
        "Failed to decline order",
      ),
    [optimisticMutation],
  );

  const startOrder = useCallback(
    (id: string) =>
      optimisticMutation(
        id,
        "IN_PROGRESS",
        {},
        `/api/orders/${id}/start`,
        undefined,
        "Failed to start order",
      ),
    [optimisticMutation],
  );

  const markKitchenOrderReady = useCallback(
    (id: string) =>
      optimisticMutation(
        id,
        "READY",
        {},
        `/api/orders/${id}/ready`,
        undefined,
        "Failed to mark order ready",
      ),
    [optimisticMutation],
  );

  const moveKitchenOrderForward = useCallback(
    async (id: string) => {
      const o = orders.find((x) => x.id === id);
      if (!o) return;
      if (o.status === "ACCEPTED") {
        await startOrder(id);
      } else if (o.status === "IN_PROGRESS") {
        await markKitchenOrderReady(id);
      }
    },
    [orders, startOrder, markKitchenOrderReady],
  );

  const moveKitchenOrderBackward = useCallback(
    async (id: string) => {
      const o = orders.find((x) => x.id === id);
      if (!o) return;
      const targetStatus: OrderStatus | null =
        o.status === "READY" ? "IN_PROGRESS" : o.status === "IN_PROGRESS" ? "ACCEPTED" : null;
      if (!targetStatus) return;

      await optimisticMutation(
        id,
        targetStatus,
        {},
        `/api/orders/${id}/revert`,
        undefined,
        "Failed to move order back",
      );
    },
    [orders, optimisticMutation],
  );

  const dispatchOrder = useCallback(
    (id: string, notify = true) =>
      optimisticMutation(
        id,
        "OUT_FOR_DELIVERY",
        { customerNotified: notify },
        `/api/orders/${id}/dispatch`,
        { notifyCustomer: notify },
        "Failed to dispatch order",
      ),
    [optimisticMutation],
  );

  const markDelivered = useCallback(
    async (id: string, notify = true) => {
      const o = orders.find((x) => x.id === id);
      if (!o) return;

      if (o.status === "READY") {
        await optimisticMutation(
          id,
          "DELIVERED",
          { customerNotified: notify },
          `/api/orders/${id}/complete`,
          { notifyCustomer: notify },
          "Failed to complete order",
        );
      } else if (o.status === "OUT_FOR_DELIVERY") {
        await optimisticMutation(
          id,
          "DELIVERED",
          {},
          `/api/orders/${id}/deliver`,
          undefined,
          "Failed to mark order delivered",
        );
      }
    },
    [orders, optimisticMutation],
  );

  // Driver self-assignment actions. Each posts to a per-driver endpoint and
  // replaces the order with the server's response (the realtime broadcast also
  // syncs every other dashboard).
  const runDriverAction = useCallback(
    async (id: string, action: "claim" | "release" | "take", errorFallback: string) => {
      if (!beginAction(id)) return;
      try {
        const data = await apiFetch<OrderResponse>(`/api/orders/${id}/${action}`, {
          method: "POST",
          auth: true,
        });
        actionTracker.applyIfCurrent(id, () => replaceOrder(data.order));
      } catch (err) {
        toast.error(describeError(err, errorFallback));
      } finally {
        endAction(id);
      }
    },
    [replaceOrder, beginAction, endAction, actionTracker],
  );

  const claimOrder = useCallback(
    (id: string) => runDriverAction(id, "claim", "Couldn't claim that order"),
    [runDriverAction],
  );
  const releaseOrder = useCallback(
    (id: string) => runDriverAction(id, "release", "Couldn't release that order"),
    [runDriverAction],
  );
  const takeOrder = useCallback(
    (id: string) => runDriverAction(id, "take", "Couldn't send that order out"),
    [runDriverAction],
  );

  // ---------------------------------------------------------------------
  // Filtered lists (unchanged)
  // ---------------------------------------------------------------------

  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === "PENDING").sort(sortByPlaced),
    [orders],
  );
  const acceptanceAcceptedOrders = useMemo(
    () =>
      orders
        .filter((o) => o.status === "ACCEPTED" || o.status === "IN_PROGRESS")
        .sort(sortByPlaced),
    [orders],
  );
  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === "READY").sort(sortByPlaced),
    [orders],
  );
  const outForDeliveryOrders = useMemo(
    () => orders.filter((o) => o.status === "OUT_FOR_DELIVERY").sort(sortByPlaced),
    [orders],
  );

  const kitchenTodoOrders = useMemo(
    () => orders.filter((o) => o.status === "ACCEPTED").sort(sortByPlaced),
    [orders],
  );
  const kitchenInProgressOrders = useMemo(
    () => orders.filter((o) => o.status === "IN_PROGRESS").sort(sortByPlaced),
    [orders],
  );
  const kitchenDoneOrders = useMemo(
    () => orders.filter((o) => o.status === "READY").sort(sortByPlaced),
    [orders],
  );

  const currentUserId = useMemo(() => getCurrentUser().id, []);

  // Unclaimed orders any driver can pick up (ready to go, or pushed out by
  // acceptance without a driver).
  const driverAvailableOrders = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.fulfillmentType !== "PICKUP" &&
            !o.assignedDriverId &&
            (o.status === "READY" || o.status === "OUT_FOR_DELIVERY"),
        )
        .sort(sortByPlaced),
    [orders],
  );

  // Orders this driver has claimed that are still in flight (ready, or out for
  // delivery). Excludes terminal statuses so delivered orders drop off the
  // board — important for admins, who can otherwise see DELIVERED orders.
  const driverMineOrders = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.fulfillmentType !== "PICKUP" &&
            !!o.assignedDriverId &&
            o.assignedDriverId === currentUserId &&
            (o.status === "READY" || o.status === "OUT_FOR_DELIVERY"),
        )
        .sort(sortByDispatched),
    [orders, currentUserId],
  );

  return {
    orders,
    loading,
    error,
    hasLoaded,
    connectionLost,
    refreshOrders,
    isOrderPending,
    pendingOrders,
    acceptanceAcceptedOrders,
    readyOrders,
    outForDeliveryOrders,
    kitchenTodoOrders,
    kitchenInProgressOrders,
    kitchenDoneOrders,
    driverAvailableOrders,
    driverMineOrders,
    acceptOrder,
    declineOrder,
    startOrder,
    moveKitchenOrderForward,
    moveKitchenOrderBackward,
    markKitchenOrderReady,
    dispatchOrder,
    markDelivered,
    claimOrder,
    releaseOrder,
    takeOrder,
  };
}
