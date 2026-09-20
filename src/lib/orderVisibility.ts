type VisibleOrder = {
  status: string;
  fulfillmentType?: "DELIVERY" | "PICKUP";
};

const STATUSES_VISIBLE_TO_ROLE: Record<string, string[]> = {
  admin: [
    "PENDING",
    "ACCEPTED",
    "IN_PROGRESS",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "DECLINED",
    "CANCELLED",
  ],
  acceptance: ["PENDING", "ACCEPTED", "IN_PROGRESS", "READY", "OUT_FOR_DELIVERY"],
  kitchen: ["ACCEPTED", "IN_PROGRESS", "READY"],
  driver: ["READY", "OUT_FOR_DELIVERY"],
};

export function isOrderVisibleToRole(order: VisibleOrder, role: string): boolean {
  const statusVisible = (STATUSES_VISIBLE_TO_ROLE[role] ?? []).includes(order.status);
  if (!statusVisible) return false;

  // Legacy payloads without fulfillmentType are deliveries. Pickup orders must
  // never enter a driver's state, including through staff-wide socket events.
  return role !== "driver" || (order.fulfillmentType ?? "DELIVERY") === "DELIVERY";
}
