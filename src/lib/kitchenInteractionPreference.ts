export type KitchenInteractionMode = "quickTap" | "buttons" | "both";

export const KITCHEN_INTERACTION_KEY = "swiftKitchen.kitchenInteractionMode";
export const KITCHEN_INTERACTION_EVENT = "swiftKitchen:kitchenInteractionChanged";
export const KITCHEN_INTERACTION_OPTIONS: {
  value: KitchenInteractionMode;
  label: string;
  description: string;
}[] = [
  {
    value: "quickTap",
    label: "Quick tap",
    description:
      "Tap the ticket to move it to the next stage. Buttons remain available for keyboard use.",
  },
  {
    value: "buttons",
    label: "Buttons only",
    description: "Status changes only through visible action buttons.",
  },
  { value: "both", label: "Both", description: "Tap the ticket for speed or use the buttons." },
];

type PreferenceStorage = Pick<Storage, "getItem" | "setItem">;

export function parseKitchenInteractionMode(value: string | null): KitchenInteractionMode {
  return value === "quickTap" || value === "buttons" || value === "both" ? value : "both";
}

export function readKitchenInteractionMode(storage: PreferenceStorage): KitchenInteractionMode {
  try {
    return parseKitchenInteractionMode(storage.getItem(KITCHEN_INTERACTION_KEY));
  } catch {
    return "both";
  }
}

export function writeKitchenInteractionMode(
  storage: PreferenceStorage,
  mode: KitchenInteractionMode,
): boolean {
  try {
    storage.setItem(KITCHEN_INTERACTION_KEY, mode);
    return true;
  } catch {
    return false;
  }
}
