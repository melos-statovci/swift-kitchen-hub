import { ShoppingBag, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function FulfillmentBadge({ fulfillmentType }: { fulfillmentType?: "DELIVERY" | "PICKUP" }) {
  const pickup = fulfillmentType === "PICKUP";
  const Icon = pickup ? ShoppingBag : Truck;

  return (
    <Badge variant="outline" className="gap-1">
      <Icon className="h-3 w-3" aria-hidden />
      {pickup ? "Pickup" : "Delivery"}
    </Badge>
  );
}
