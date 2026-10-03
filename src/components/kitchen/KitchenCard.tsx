import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StickyNote, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";
import { kitchenActionsForStatus } from "@/lib/kitchenActions";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";

type Props = {
  order: Order;
  pending: boolean;
  onStart: (id: string) => void;
  onMarkReady: (id: string) => void;
  onMoveBack: (id: string) => void;
};

function minutesSince(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));
}

export function KitchenCard({ order, pending, onStart, onMarkReady, onMoveBack }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const minutes = minutesSince(order.placedAt, now);
  const urgency = minutes >= 25 ? "critical" : minutes >= 15 ? "warning" : "normal";
  const actions = kitchenActionsForStatus(order.status);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const accent =
    order.status === "IN_PROGRESS"
      ? "border-l-4 border-l-amber-500"
      : order.status === "READY"
        ? "border-l-4 border-l-emerald-500"
        : "border-l-4 border-l-transparent";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn("min-w-0 rounded-lg bg-card p-3.5 shadow-sm", accent)}
      aria-label={`Order ${order.orderNumber}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xl font-bold tracking-tight">#{order.orderNumber}</h3>
          <div className="mt-1">
            <FulfillmentBadge fulfillmentType={order.fulfillmentType} />
          </div>
        </div>
        <div
          className={cn(
            "shrink-0 rounded-md px-2.5 py-1 text-xl font-bold tabular-nums leading-none",
            urgency === "normal" && "bg-muted text-foreground",
            urgency === "warning" &&
              "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
            urgency === "critical" &&
              "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200",
          )}
        >
          {minutes}m
        </div>
      </div>

      <div className="mt-2 flex flex-wrap justify-between gap-x-3 text-xs font-medium text-muted-foreground">
        <span>{minutes} min since placed</span>
        <span>
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </span>
      </div>

      {order.customerNotes && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/50 dark:text-amber-100">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 break-words">
            <span className="block text-xs font-bold uppercase tracking-wide">Order note</span>
            {order.customerNotes}
          </div>
        </div>
      )}

      <ul className="mt-3 space-y-3 border-t border-border/60 pt-3">
        {order.items.map((item) => (
          <li key={item.id} className="min-w-0 text-base leading-snug">
            <div className="flex items-start gap-2 font-semibold">
              <span className="shrink-0 text-lg tabular-nums">{item.quantity} ×</span>
              <span className="min-w-0 break-words text-lg">{item.nameSnapshot}</span>
            </div>
            {item.variantNameSnapshot && (
              <div className="ml-8 mt-0.5 w-fit max-w-[calc(100%-2rem)] break-words rounded bg-muted px-1.5 py-0.5 text-sm font-medium text-muted-foreground">
                {item.variantNameSnapshot}
              </div>
            )}
            {item.notes && (
              <div className="ml-8 mt-0.5 break-words text-sm font-semibold text-amber-800 dark:text-amber-200">
                ↳ {item.notes}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
        <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">{order.customerName}</span>
        <span className="ml-auto shrink-0 font-medium">
          {order.status === "ACCEPTED"
            ? "To do"
            : order.status === "IN_PROGRESS"
              ? "In progress"
              : "Ready"}
        </span>
      </div>

      {(actions.primary || actions.canMoveBack) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.primary === "start" && (
            <Button
              className="min-h-11 min-w-0 flex-1"
              disabled={pending}
              onClick={() => onStart(order.id)}
            >
              Start
            </Button>
          )}
          {actions.primary === "ready" && (
            <Button
              className="min-h-11 min-w-0 flex-1"
              disabled={pending}
              onClick={() => onMarkReady(order.id)}
            >
              Mark ready
            </Button>
          )}
          {actions.canMoveBack && (
            <Button
              variant="outline"
              className="min-h-11 min-w-0 flex-1"
              disabled={pending}
              onClick={() => onMoveBack(order.id)}
            >
              Move back
            </Button>
          )}
        </div>
      )}
    </motion.article>
  );
}
