import { useEffect, useState, type MouseEvent, type PointerEvent } from "react";
import { createKitchenSurfaceGesture } from "@/lib/kitchenInteraction";
import type { KitchenInteractionMode } from "@/lib/kitchenInteractionPreference";
import type { OrderStatus } from "@/lib/types";

const INTERACTIVE =
  '[data-kitchen-no-advance], button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="radio"], [contenteditable]:not([contenteditable="false"]), [tabindex]';

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE) !== null;
}

/** Only this non-interactive surface owns tapping; action controls are siblings. */
export function useKitchenTicketSurface(
  mode: KitchenInteractionMode,
  status: OrderStatus,
  pending: boolean,
  onAdvance: (expectedStatus: OrderStatus) => void,
) {
  const [gesture] = useState(createKitchenSurfaceGesture);
  useEffect(() => {
    const cancel = () => gesture.cancel();
    document.addEventListener("scroll", cancel, true);
    return () => document.removeEventListener("scroll", cancel, true);
  }, [gesture]);

  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) =>
      gesture.start({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        isPrimary: event.isPrimary,
        mode,
        status,
        pending,
        interactive: event.defaultPrevented || isInteractive(event.target),
      }),
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => gesture.move(event),
    onPointerUp: (event: PointerEvent<HTMLDivElement>) =>
      gesture.end(event.pointerId, event.clientX, event.clientY),
    onPointerCancel: () => gesture.cancel(),
    onClick: (event: MouseEvent<HTMLDivElement>) => {
      if (
        gesture.consume({
          mode,
          status,
          pending,
          detail: event.detail,
          button: event.button,
          interactive: event.defaultPrevented || isInteractive(event.target),
          textSelected: window.getSelection()?.isCollapsed === false,
        })
      )
        onAdvance(status);
    },
  };
}
