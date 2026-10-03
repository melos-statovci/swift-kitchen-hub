/** Tracks pending actions independently of rendering and lane movement. */
export function createOrderActionTracker() {
  const pending = new Map<string, boolean>();
  return {
    begin(id: string) {
      if (pending.has(id)) return false;
      pending.set(id, false);
      return true;
    },
    ids: () => new Set(pending.keys()),
    noteServerEvent(id: string) {
      if (pending.has(id)) pending.set(id, true);
    },
    applyIfCurrent(id: string, apply: () => void) {
      if (pending.get(id) === false) apply();
    },
    finish(id: string) {
      const needsReconciliation = pending.get(id) === true;
      pending.delete(id);
      return needsReconciliation;
    },
  };
}

export function mergeOrderSnapshot<T extends { id: string }>(
  snapshot: T[],
  current: T[],
  protectedIds: Set<string>,
): T[] {
  return [
    ...snapshot.filter((order) => !protectedIds.has(order.id)),
    ...current.filter((order) => protectedIds.has(order.id)),
  ];
}

type ConnectionSource = {
  connected: boolean;
  on: (event: "connect" | "disconnect" | "connect_error", listener: () => void) => unknown;
  off: (event: "connect" | "disconnect" | "connect_error", listener: () => void) => unknown;
};
export function observeOrderConnection(
  socket: ConnectionSource,
  onLost: (lost: boolean) => void,
  onRecover: () => void,
) {
  let interrupted = !socket.connected;
  onLost(interrupted);
  const disconnected = () => {
    interrupted = true;
    onLost(true);
  };
  const connected = () => {
    onLost(false);
    if (interrupted) {
      interrupted = false;
      onRecover();
    }
  };
  socket.on("connect", connected);
  socket.on("disconnect", disconnected);
  socket.on("connect_error", disconnected);
  return () => {
    socket.off("connect", connected);
    socket.off("disconnect", disconnected);
    socket.off("connect_error", disconnected);
  };
}
