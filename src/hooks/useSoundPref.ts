import { useEffect, useState } from "react";
import { SOUND_EVENT, isSoundEnabled, setSoundEnabled, primeAudio, playChime } from "@/lib/sound";

/**
 * Reactive view of the order-sound preference for the navbar toggle.
 * Stays in sync across tabs (storage event) and components (custom event).
 */
export function useSoundPref() {
  const [enabled, setEnabled] = useState<boolean>(isSoundEnabled);

  useEffect(() => {
    const sync = () => setEnabled(isSoundEnabled());
    window.addEventListener(SOUND_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SOUND_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    // Turning it on is a user gesture — unlock audio and give an instant
    // preview so they know what to expect.
    if (next) {
      primeAudio();
      playChime();
    }
  };

  return { enabled, toggle };
}
