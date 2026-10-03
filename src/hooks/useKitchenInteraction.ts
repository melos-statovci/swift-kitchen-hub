import { useSyncExternalStore } from "react";
import {
  KITCHEN_INTERACTION_EVENT,
  KITCHEN_INTERACTION_KEY,
  readKitchenInteractionMode,
  writeKitchenInteractionMode,
  type KitchenInteractionMode,
} from "@/lib/kitchenInteractionPreference";

function getMode(): KitchenInteractionMode {
  try {
    return readKitchenInteractionMode(window.localStorage);
  } catch {
    return "both";
  }
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KITCHEN_INTERACTION_KEY || event.key === null) onChange();
  };
  window.addEventListener(KITCHEN_INTERACTION_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(KITCHEN_INTERACTION_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function setMode(mode: KitchenInteractionMode): boolean {
  try {
    if (!writeKitchenInteractionMode(window.localStorage, mode)) return false;
    window.dispatchEvent(new Event(KITCHEN_INTERACTION_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function useKitchenInteraction() {
  const mode = useSyncExternalStore(subscribe, getMode, () => "both" as const);
  return { mode, setMode };
}
