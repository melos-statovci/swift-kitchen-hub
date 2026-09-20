import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Phone, MapPin, StickyNote, ChefHat, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { formatCurrency, formatRelative, formatTime } from "@/lib/format";
import { AgeBadge } from "@/components/AgeBadge";
import { minutesInStatus, ageLevelFor, AGE_BORDER } from "@/lib/orderAge";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";

type Props = {
  order: Order;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onDispatch?: (id: string) => void;
  onPickup?: (id: string) => void;
};

export function OrderCard({ order, onAccept, onDecline, onDispatch, onPickup }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [, force] = useState(0);

  // re-render every 30s so relative times stay fresh
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);
  const minutes = minutesInStatus(order);
  const ageLevel = minutes !== null ? ageLevelFor(minutes) : null;

  return (
    <Card
      className={cn(
        "p-4 gap-0 transition-shadow hover:shadow-md",
        ageLevel && "border-l-4",
        ageLevel && AGE_BORDER[ageLevel],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-base font-bold tracking-tight">#{order.orderNumber}</div>
            {minutes !== null && <AgeBadge minutes={minutes} />}
            <FulfillmentBadge fulfillmentType={order.fulfillmentType} />
          </div>
          <div className="text-xs text-muted-foreground">
            {formatRelative(order.placedAt)} · {formatTime(order.placedAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold tabular-nums">{formatCurrency(order.total)}</div>
          <div className="text-xs text-muted-foreground">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1 text-sm">
        <div className="font-medium">{order.customerName}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3 w-3" aria-hidden />
          <span>{order.customerPhone}</span>
        </div>
        {order.fulfillmentType !== "PICKUP" && order.customerAddress && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span className={cn(!expanded && "line-clamp-1")}>{order.customerAddress}</span>
          </div>
        )}
      </div>

      {order.customerNotes && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{order.customerNotes}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {expanded ? "Hide items" : "Show items"}
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1 rounded-md bg-muted/40 p-2.5 text-xs">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-medium">
                  {item.nameSnapshot} × {item.quantity}
                </span>
                {item.variantNameSnapshot && (
                  <div className="font-medium text-muted-foreground">
                    {item.variantNameSnapshot}
                  </div>
                )}
                {item.notes && <div className="text-muted-foreground italic">↳ {item.notes}</div>}
              </div>
              <span className="tabular-nums text-muted-foreground">
                {formatCurrency(item.priceSnapshot * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {order.status === "PENDING" && (
          <div className="flex flex-col gap-2">
            <Button size="lg" className="h-11 flex-1" onClick={() => onAccept?.(order.id)}>
              Accept
            </Button>
            <Button
              size="lg"
              variant="destructive"
              className="h-11 flex-1"
              onClick={() => onDecline?.(order.id)}
            >
              Decline
            </Button>
          </div>
        )}
        {(order.status === "ACCEPTED" || order.status === "IN_PROGRESS") && (
          <Badge variant="secondary" className="gap-1.5">
            <ChefHat className="h-3.5 w-3.5" aria-hidden />
            {order.status === "ACCEPTED" ? "In kitchen" : "Cooking"}
          </Badge>
        )}
        {order.status === "READY" && (
          <div className="flex flex-col gap-2">
            {order.fulfillmentType !== "PICKUP" && (
              <Button size="lg" className="h-11 flex-1" onClick={() => onDispatch?.(order.id)}>
                Dispatch delivery
              </Button>
            )}
            <Button
              size="lg"
              variant="secondary"
              className="h-11 flex-1"
              onClick={() => onPickup?.(order.id)}
            >
              {order.fulfillmentType === "PICKUP" ? "Complete pickup" : "Complete without driver"}
            </Button>
          </div>
        )}
        {order.status === "OUT_FOR_DELIVERY" && (
          <Badge variant="secondary" className="gap-1.5">
            <Truck className="h-3.5 w-3.5" aria-hidden />
            {order.assignedDriver ? `With ${order.assignedDriver.name}` : "Out for delivery"}
          </Badge>
        )}
      </div>
    </Card>
  );
}
