import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { KitchenInteractionSettings } from "./KitchenInteractionSettings";

export function KitchenInteractionControl() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="min-h-11"
          aria-label="Kitchen controls for this device"
        >
          Controls
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Kitchen controls</DialogTitle>
          <DialogDescription>Choose how this browser changes kitchen tickets.</DialogDescription>
        </DialogHeader>
        <KitchenInteractionSettings />
      </DialogContent>
    </Dialog>
  );
}
