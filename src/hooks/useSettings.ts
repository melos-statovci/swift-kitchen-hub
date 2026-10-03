import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiError, NetworkError } from "@/lib/api";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DayHours = {
  open: string | null;
  close: string | null;
};

export type RestaurantSettings = {
  deliveryFee: number; // cents
  isPaused: boolean;
  pauseMessage: string | null;
  hours: Record<DayKey, DayHours>;
  updatedAt: string;
};

export type OpenStatus =
  | { isOpen: true }
  | {
      isOpen: false;
      reason: "closed-today" | "before-open" | "after-close";
      nextOpen: string | null;
    };

type GetSettingsResponse = {
  settings: RestaurantSettings;
  openStatus: OpenStatus;
};

export type SettingsPatch = Partial<{
  deliveryFee: number;
  isPaused: boolean;
  pauseMessage: string | null;
  monOpen: string | null;
  monClose: string | null;
  tueOpen: string | null;
  tueClose: string | null;
  wedOpen: string | null;
  wedClose: string | null;
  thuOpen: string | null;
  thuClose: string | null;
  friOpen: string | null;
  friClose: string | null;
  satOpen: string | null;
  satClose: string | null;
  sunOpen: string | null;
  sunClose: string | null;
}>;

export function useSettings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [openStatus, setOpenStatus] = useState<OpenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const retry = useCallback(() => setLoadVersion((version) => version + 1), []);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    // No auth needed - public endpoint
    apiFetch<GetSettingsResponse>("/api/settings", { signal: ac.signal })
      .then((data) => {
        if (cancelled) return;
        setSettings(data.settings);
        setOpenStatus(data.openStatus);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || ac.signal.aborted) return;
        if (err instanceof NetworkError) setError("Could not reach the server.");
        else if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load settings.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [loadVersion]);

  const save = useCallback(async (patch: SettingsPatch): Promise<void> => {
    setSaving(true);
    try {
      // PATCH returns the raw DB row (snake_case wouldn't matter since Prisma
      // converts), but we re-fetch settings + openStatus to be safe.
      await apiFetch("/api/settings", {
        method: "PATCH",
        auth: true,
        body: patch,
      });

      // Refetch to get the canonical computed shape (openStatus etc.)
      try {
        const fresh = await apiFetch<GetSettingsResponse>("/api/settings");
        setSettings(fresh.settings);
        setOpenStatus(fresh.openStatus);
      } catch {
        const message =
          "Changes were sent, but saved settings could not be checked. Retry to confirm the service status.";
        setError(message);
        throw new Error(message);
      }
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, openStatus, loading, error, saving, save, retry };
}
