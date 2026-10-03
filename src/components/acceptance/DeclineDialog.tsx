import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const PRESETS = ["Out of stock", "Too far", "Closing soon", "Other"];

type Props = {
  orderNumber: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
};

export function DeclineDialog({ orderNumber, open, onOpenChange, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setReason("");
      setActivePreset(null);
    }
    onOpenChange(v);
  };

  const pickPreset = (preset: string) => {
    setActivePreset(preset);
    if (preset !== "Other") setReason(preset);
    else setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decline order {orderNumber ? `#${orderNumber}` : ""}</DialogTitle>
          <DialogDescription>
            Optionally provide a reason. The customer will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Common decline reasons">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={activePreset === preset ? "default" : "outline"}
                className="h-10 px-3 text-xs"
                aria-pressed={activePreset === preset}
                onClick={() => pickPreset(preset)}
              >
                {preset}
              </Button>
            ))}
          </div>
          <label htmlFor="decline-reason" className="text-sm font-medium">
            Reason (optional)
          </label>
          <Textarea
            id="decline-reason"
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setActivePreset("Other");
            }}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm(reason.trim());
              handleOpenChange(false);
            }}
          >
            Confirm decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
