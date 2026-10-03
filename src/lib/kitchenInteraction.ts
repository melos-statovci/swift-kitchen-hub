import { kitchenActionsForStatus } from "./kitchenActions.ts";
import type { Order, OrderStatus } from "./types";
import type { KitchenInteractionMode } from "./kitchenInteractionPreference";

export type KitchenActionSource = "surface" | "forward" | "back";
type KitchenAction = "start" | "ready" | "back";
type CurrentTicket = {
  order: Pick<Order, "id" | "status" | "fulfillmentType">;
  mode: KitchenInteractionMode;
  pending: boolean;
};
type ActionRequest = {
  order: Pick<Order, "id">;
  expectedStatus: OrderStatus;
  source: KitchenActionSource;
};

/** Shared by ticket taps and explicit controls, including across lane remounts. */
export function createKitchenActionGate(getCurrent: (id: string) => CurrentTicket | null) {
  const inFlight = new Set<string>();
  return {
    async run(
      { order: target, expectedStatus, source }: ActionRequest,
      perform: (action: KitchenAction, id: string) => Promise<unknown>,
    ): Promise<boolean> {
      const current = getCurrent(target.id);
      if (!current) return false;
      const { order, pending, mode } = current;
      if (
        pending ||
        inFlight.has(order.id) ||
        order.status !== expectedStatus ||
        (source === "surface" && mode === "buttons")
      )
        return false;
      const actions = kitchenActionsForStatus(order.status);
      const action = source === "back" ? (actions.canMoveBack ? "back" : null) : actions.primary;
      if (!action) return false;
      inFlight.add(order.id);
      try {
        await perform(action, order.id);
        return true;
      } finally {
        inFlight.delete(order.id);
      }
    },
  };
}

type PointerStart = {
  pointerId: number;
  clientX: number;
  clientY: number;
  button: number;
  isPrimary: boolean;
  mode: KitchenInteractionMode;
  status: OrderStatus;
  pending: boolean;
  interactive: boolean;
};
type SurfaceClick = Pick<PointerStart, "button" | "mode" | "status" | "pending" | "interactive"> & {
  detail: number;
  textSelected: boolean;
};

/** A forward tap needs one stationary, primary pointer gesture on the same status. */
export function createKitchenSurfaceGesture() {
  let gesture: (PointerStart & { released: boolean }) | null = null;
  return {
    start(input: PointerStart) {
      gesture =
        input.isPrimary &&
        input.button === 0 &&
        input.mode !== "buttons" &&
        !input.pending &&
        !input.interactive &&
        kitchenActionsForStatus(input.status).primary
          ? { ...input, released: false }
          : null;
    },
    move(input: Pick<PointerStart, "pointerId" | "clientX" | "clientY">) {
      if (
        gesture?.pointerId === input.pointerId &&
        Math.hypot(input.clientX - gesture.clientX, input.clientY - gesture.clientY) > 8
      ) {
        gesture = null;
      }
    },
    end(pointerId: number, clientX: number, clientY: number) {
      if (gesture?.pointerId !== pointerId) return;
      if (Math.hypot(clientX - gesture.clientX, clientY - gesture.clientY) > 8) {
        gesture = null;
        return;
      }
      gesture.released = true;
    },
    cancel() {
      gesture = null;
    },
    consume(input: SurfaceClick): boolean {
      const current = gesture;
      gesture = null;
      return Boolean(
        current?.released &&
        input.detail === 1 &&
        input.button === 0 &&
        input.mode !== "buttons" &&
        !input.pending &&
        !input.interactive &&
        !input.textSelected &&
        input.status === current.status,
      );
    },
  };
}
