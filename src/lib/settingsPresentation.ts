export function getSettingsPresentation(
  savedPaused: boolean,
  savedOpen: boolean | null,
  draftPaused: boolean,
): {
  savedService: "paused" | "open" | "closed" | "unknown";
  draftPause: boolean | null;
} {
  return {
    savedService: savedPaused
      ? "paused"
      : savedOpen === null
        ? "unknown"
        : savedOpen
          ? "open"
          : "closed",
    draftPause: draftPaused === savedPaused ? null : draftPaused,
  };
}
