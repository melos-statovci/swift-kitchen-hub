import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { StickyNote, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Order } from "@/lib/types";
import { FulfillmentBadge } from "@/components/FulfillmentBadge";

type Props = {
  order: Order;
  onSingleTap: (id: string) => void;
  onDoubleTap: (id: string) => void;
};

const DOUBLE_TAP_MS = 280;

function minutesSince(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60_000));
}

export function KitchenCard({ order, onSingleTap, onDoubleTap }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const minutes = minutesSince(order.placedAt, now);
  const urgency = minutes >= 25 ? "critical" : minutes >= 15 ? "warning" : "normal";

  const accent =
    order.status === "IN_PROGRESS"
      ? "border-l-4 border-l-amber-500"
      : order.status === "READY"
        ? "border-l-4 border-l-emerald-500"
        : "border-l-4 border-l-transparent";

  const handleClick = () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      onDoubleTap(order.id);
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      onSingleTap(order.id);
    }, DOUBLE_TAP_MS);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      onClick={handleClick}
      className={cn(
        "cursor-pointer select-none rounded-lg bg-card p-4 shadow-sm transition-shadow active:shadow-inner hover:shadow-md",
        accent,
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSingleTap(order.id);
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-bold tracking-tight">#{order.orderNumber}</div>
          <FulfillmentBadge fulfillmentType={order.fulfillmentType} />
        </div>
        <div
          className={cn(
            "rounded-md px-2.5 py-1 text-2xl font-bold tabular-nums leading-none",
            urgency === "normal" && "bg-muted text-foreground",
            urgency === "warning" &&
              "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
            urgency === "critical" &&
              "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200 animate-pulse",
          )}
        >
          {minutes}m
        </div>
      </div>

      {order.customerNotes && (
        <div className="mt-3 flex items-start gap-2 rounded-md border-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/50 dark:text-amber-100">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{order.customerNotes}</span>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {order.items.map((item) => (
          <li key={item.id} className="text-base leading-snug">
            <div className="font-semibold">
              <span className="tabular-nums">{item.quantity}</span> × {item.nameSnapshot}
            </div>
            {item.variantNameSnapshot && (
              <div className="pl-6 text-sm font-medium text-muted-foreground">
                {item.variantNameSnapshot}
              </div>
            )}
            {item.notes && (
              <div className="pl-6 text-sm italic text-muted-foreground">{item.notes}</div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-1.5 border-t border-border pt-2 text-xs text-muted-foreground">
        <User className="h-3 w-3" aria-hidden />
        <span>{order.customerName}</span>
      </div>
    </motion.div>
  );
}
