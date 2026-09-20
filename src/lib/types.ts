export type UserRole = "admin" | "acceptance" | "kitchen" | "driver";

export type Category = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | null; // cents; null when variantMode is REQUIRED
  variantMode: "NONE" | "REQUIRED";
  variants: MenuItemVariant[];
  category: string; // category slug
  imageUrl: string | null;
  available: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MenuItemVariant = {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  sortOrder: number;
  available: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StaffUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};

export type OrderStatus =
  | "PENDING"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "DECLINED"
  | "CANCELLED";

export type OrderItem = {
  id: string;
  menuItemId: string;
  variantId: string | null;
  nameSnapshot: string;
  priceSnapshot: number;
  variantNameSnapshot: string | null;
  variantPriceSnapshot: number | null;
  quantity: number;
  notes: string | null;
};

export type Order = {
  id: string;
  orderNumber: string;
  trackingToken: string;
  cancelToken: string | null;
  status: OrderStatus;
  fulfillmentType: "DELIVERY" | "PICKUP";
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  customerNotes: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  declineReason: string | null;
  customerNotified: boolean;
  assignedDriverId: string | null;
  assignedDriver: { id: string; name: string } | null;
  placedAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  declinedAt: string | null;
  items: OrderItem[];
};
