// Order notification chime + on/off preference.
//
// The tone is generated with the Web Audio API rather than shipping an audio
// file — no asset to host and no licensing to track. Preference is persisted
// to localStorage (default: on) and broadcast via a window event so the navbar
// toggle and any listeners stay in sync.

const SOUND_KEY = "sk_sound_enabled";
export const SOUND_EVENT = "sk-sound-change";

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  // Default on: only "off" disables it.
  return localStorage.getItem(SOUND_KEY) !== "off";
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  window.dispatchEvent(new Event(SOUND_EVENT));
}

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

/**
 * Create/resume the AudioContext from within a user gesture (e.g. the navbar
 * toggle click). Browsers block audio until the first interaction, so calling
 * this on a click "unlocks" later programmatic chimes.
 */
export function primeAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

/**
 * Play a short two-note "ding-ding" notification. No-op when sound is
 * disabled, the browser has no Web Audio, or the context is still locked
 * (no user gesture yet).
 */
export function playChime(): void {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const notes = [
    { freq: 880, start: 0, dur: 0.12 }, // A5
    { freq: 1320, start: 0.13, dur: 0.18 }, // E6
  ];

  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = n.freq;

    // Soft attack + exponential decay so it reads as a chime, not a click.
    const t = now + n.start;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + n.dur + 0.02);
  }
}
