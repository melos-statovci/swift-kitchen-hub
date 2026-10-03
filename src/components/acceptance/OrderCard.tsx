import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Phone, MapPin, StickyNote, ChefHat, Truck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { formatCurrency, formatTime } from "@/lib/format";
import { AgeBadge } from "@/components/AgeBadge";
import { minutesInStatus, ageLevelFor, AGE_BORDER } from "@/lib/orderAge";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";

type Props = {
  order: Order;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onDispatch?: (id: string) => void;
  onPickup?: (id: string) => void;
  pending?: boolean;
};

const stageLabels: Partial<Record<Order["status"], string>> = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  IN_PROGRESS: "in progress",
  READY: "ready",
  OUT_FOR_DELIVERY: "out for delivery",
};

export function OrderCard({
  order,
  onAccept,
  onDecline,
  onDispatch,
  onPickup,
  pending = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [, force] = useState(0);

  // Re-render every 30s so time in the current stage stays fresh.
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
        "min-w-0 gap-0 p-3.5 transition-shadow hover:shadow-md",
        ageLevel && "border-l-4",
        ageLevel && AGE_BORDER[ageLevel],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="text-lg font-bold leading-none tracking-tight">
              #{order.orderNumber}
            </div>
            {minutes !== null && <AgeBadge minutes={minutes} />}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {minutes !== null && `${minutes} min in ${stageLabels[order.status]} · `}
            Placed {formatTime(order.placedAt)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular-nums">{formatCurrency(order.total)}</div>
          <div className="text-xs text-muted-foreground">
            {itemCount} item{itemCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      <div className="mt-2.5 border-t border-border/60 pt-2.5">
        <FulfillmentBadge fulfillmentType={order.fulfillmentType} />
      </div>

      <div className="mt-2 space-y-1 text-sm">
        <div className="break-words font-semibold leading-snug">{order.customerName}</div>
        <a
          href={`tel:${order.customerPhone.replace(/[^\d+]/g, "")}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Phone className="h-3 w-3 shrink-0" aria-hidden />
          <span className="break-all">{order.customerPhone}</span>
        </a>
        {order.fulfillmentType !== "PICKUP" && order.customerAddress && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span className={cn("min-w-0 break-words", !expanded && "line-clamp-2")}>
              {order.customerAddress}
            </span>
          </div>
        )}
      </div>

      {order.customerNotes && (
        <div className="mt-2.5 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-100">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <div className="min-w-0 break-words">
            <span className="block text-[10px] font-bold uppercase tracking-wide">Order note</span>
            {order.customerNotes}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2.5 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        aria-expanded={expanded}
        aria-label={`${expanded ? "Hide" : "View"} ${order.items.length} lines and ${itemCount} items for order ${order.orderNumber}`}
      >
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        {order.items.length} {order.items.length === 1 ? "line" : "lines"} · {itemCount}{" "}
        {itemCount === 1 ? "item" : "items"} — {expanded ? "Hide items" : "View items"}
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1.5 rounded-md bg-muted/40 p-2.5 text-sm">
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
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                {formatCurrency(item.priceSnapshot * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        {order.status === "PENDING" && (
          <div className="flex gap-2">
            <Button
              className="h-11 min-w-0 flex-1"
              disabled={pending}
              onClick={() => onAccept?.(order.id)}
            >
              Accept
            </Button>
            <Button
              variant="outline"
              className="h-11 min-w-0 flex-1 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={pending}
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
              <Button
                className="h-11 w-full"
                disabled={pending}
                onClick={() => onDispatch?.(order.id)}
              >
                Dispatch delivery
              </Button>
            )}
            <Button
              variant="secondary"
              className="h-auto min-h-11 w-full whitespace-normal py-1.5 text-center"
              disabled={pending}
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
