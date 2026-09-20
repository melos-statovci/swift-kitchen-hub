import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type Mode = "dispatch" | "pickup";

type Props = {
  mode: Mode;
  fulfillmentType?: "DELIVERY" | "PICKUP";
  orderNumber: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (notify: boolean) => void;
};

export function ConfirmDialog({
  mode,
  fulfillmentType,
  orderNumber,
  open,
  onOpenChange,
  onConfirm,
}: Props) {
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (open) setNotify(true);
  }, [open]);

  const title =
    mode === "dispatch"
      ? `Dispatch order ${orderNumber ? `#${orderNumber}` : ""}`
      : `Complete order ${orderNumber ? `#${orderNumber}` : ""}`;
  const description =
    mode === "dispatch"
      ? "Mark this order as out for delivery."
      : fulfillmentType === "PICKUP"
        ? "Mark this pickup order as collected."
        : "Complete this delivery without sending it through the driver workflow.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-3">
          <Label htmlFor="notify" className="text-sm font-medium">
            Notify customer
          </Label>
          <Switch id="notify" checked={notify} onCheckedChange={setNotify} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(notify);
              onOpenChange(false);
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
