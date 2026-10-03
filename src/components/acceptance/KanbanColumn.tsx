import { forwardRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  count: number;
  pulseWhenActive?: boolean;
  children: ReactNode;
};

export const KanbanColumn = forwardRef<HTMLDivElement, Props>(function KanbanColumn(
  { title, count, pulseWhenActive, children },
  ref,
) {
  const shouldPulse = pulseWhenActive && count > 0;
  return (
    <div
      ref={ref}
      className="flex min-h-0 min-w-0 snap-start flex-col rounded-lg border border-border bg-muted/30"
    >
      <div
        className={cn(
          "sticky top-0 z-10 flex items-center justify-between rounded-t-lg border-b border-border bg-background/95 px-3 py-2.5 backdrop-blur",
        )}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          <span
            className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground",
              shouldPulse && "bg-primary text-primary-foreground animate-pulse",
            )}
          >
            {count}
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
        {count === 0 ? (
          <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
            No orders
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
});
