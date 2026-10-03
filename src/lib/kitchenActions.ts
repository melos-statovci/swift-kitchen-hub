import type { OrderStatus } from "./types";

export type KitchenPrimaryAction = "start" | "ready" | null;

export function kitchenActionsForStatus(status: OrderStatus): {
  primary: KitchenPrimaryAction;
  canMoveBack: boolean;
} {
  if (status === "ACCEPTED") return { primary: "start", canMoveBack: false };
  if (status === "IN_PROGRESS") return { primary: "ready", canMoveBack: true };
  if (status === "READY") return { primary: null, canMoveBack: true };
  return { primary: null, canMoveBack: false };
}
