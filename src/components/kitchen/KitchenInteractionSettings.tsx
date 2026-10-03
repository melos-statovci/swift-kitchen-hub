import { useState } from "react";
import { useKitchenInteraction } from "@/hooks/useKitchenInteraction";
import {
  KITCHEN_INTERACTION_OPTIONS,
  parseKitchenInteractionMode,
} from "@/lib/kitchenInteractionPreference";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export function KitchenInteractionSettings() {
  const { mode, setMode } = useKitchenInteraction();
  const [error, setError] = useState<string | null>(null);
  return (
    <section
      className="space-y-4 rounded-lg border border-border bg-background p-4 sm:p-6"
      aria-labelledby="kitchen-interaction-heading"
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="kitchen-interaction-heading" className="text-lg font-semibold">
            Kitchen interaction
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            This device
          </span>
        </div>
        <p id="kitchen-interaction-description" className="mt-1 text-sm text-muted-foreground">
          How should kitchen tickets change status? Applies immediately on this browser; other
          devices keep their own choice.
        </p>
      </div>
      <RadioGroup
        value={mode}
        aria-labelledby="kitchen-interaction-heading"
        aria-describedby="kitchen-interaction-description"
        onValueChange={(value) => {
          setError(
            setMode(parseKitchenInteractionMode(value))
              ? null
              : "Could not save this device preference. Check that browser storage is available and try again.",
          );
        }}
        className="gap-3"
      >
        {KITCHEN_INTERACTION_OPTIONS.map((option) => (
          <Label
            key={option.value}
            htmlFor={`kitchen-mode-${option.value}`}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border p-3 has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroupItem
              id={`kitchen-mode-${option.value}`}
              value={option.value}
              className="mt-0.5 shrink-0"
              aria-describedby={`kitchen-mode-${option.value}-description`}
            />
            <span className="min-w-0 space-y-1">
              <span className="block text-sm font-semibold">
                {option.label}
                {option.value === "both" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Default</span>
                )}
              </span>
              <span
                id={`kitchen-mode-${option.value}-description`}
                className="block text-sm font-normal leading-snug text-muted-foreground"
              >
                {option.description}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground">
        Move back always uses its button. This device preference does not need Save settings.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
