import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { RequireRole } from "@/components/RequireRole";
import { useSettings, type DayKey, type SettingsPatch } from "@/hooks/useSettings";
import { ApiError, NetworkError } from "@/lib/api";
import { isValidHoursPair } from "@/lib/schedule";
import { appConfig } from "@/lib/config";
import { getSettingsPresentation } from "@/lib/settingsPresentation";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => (
    <RequireRole route="admin">
      <SettingsPage />
    </RequireRole>
  ),
});

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

// Default pause message if admin leaves the textarea blank
const DEFAULT_PAUSE_MESSAGE = "We're temporarily not accepting orders. Please try again soon.";

type FormState = {
  deliveryFeeEuros: string; // form value, converted to cents on save
  isPaused: boolean;
  pauseMessage: string;
  hours: Record<DayKey, { open: string; close: string; closed: boolean }>;
};

function SettingsPage() {
  const { settings, openStatus, loading, error: loadError, saving, save, retry } = useSettings();
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Hydrate form when settings arrive
  useEffect(() => {
    if (!settings) return;
    setFormError(null);
    setForm({
      deliveryFeeEuros: (settings.deliveryFee / 100).toFixed(2),
      isPaused: settings.isPaused,
      pauseMessage: settings.pauseMessage ?? "",
      hours: DAYS.reduce(
        (acc, { key }) => {
          const h = settings.hours[key];
          acc[key] = {
            open: h.open ?? "10:00",
            close: h.close ?? "22:00",
            closed: !h.open || !h.close,
          };
          return acc;
        },
        {} as FormState["hours"],
      ),
    });
  }, [settings]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading settings…</p>
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <div
        className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center"
        role="alert"
      >
        <h1 className="font-semibold">Settings unavailable</h1>
        <p className="text-sm text-destructive">
          {loadError ?? "Could not load restaurant settings."}
        </p>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!form)
    return (
      <p role="status" className="py-10 text-sm text-muted-foreground">
        Preparing settings…
      </p>
    );

  const setHour = (day: DayKey, field: "open" | "close" | "closed", value: string | boolean) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        hours: {
          ...prev.hours,
          [day]: { ...prev.hours[day], [field]: value },
        },
      };
    });
  };

  const handleSave = async () => {
    if (!form || saving) return;
    setFormError(null);

    // Validate delivery fee
    const fee = Number(form.deliveryFeeEuros);
    if (Number.isNaN(fee) || fee < 0 || fee > 100) {
      setFormError(`Delivery fee must be between 0 and 100 ${appConfig.currency}.`);
      return;
    }
    const deliveryFeeCents = Math.round(fee * 100);

    // Build patch
    const patch: SettingsPatch = {
      deliveryFee: deliveryFeeCents,
      isPaused: form.isPaused,
      pauseMessage: form.pauseMessage.trim() || null,
    };

    // Validate hours and add to patch (null when closed)
    for (const { key, label } of DAYS) {
      const h = form.hours[key];
      if (h.closed) {
        patch[`${key}Open` as keyof SettingsPatch] = null as never;
        patch[`${key}Close` as keyof SettingsPatch] = null as never;
      } else {
        if (!isValidHoursPair(h.open, h.close)) {
          setFormError(
            `${label}: enter two different valid times in HH:MM format. Overnight hours are allowed.`,
          );
          return;
        }
        patch[`${key}Open` as keyof SettingsPatch] = h.open as never;
        patch[`${key}Close` as keyof SettingsPatch] = h.close as never;
      }
    }

    try {
      await save(patch);
      toast.success("Settings saved");
    } catch (err) {
      const message =
        err instanceof NetworkError
          ? "Could not reach the server."
          : err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to save settings.";
      setFormError(message);
      toast.error(message);
    }
  };

  const presentation = getSettingsPresentation(
    settings.isPaused,
    openStatus?.isOpen ?? null,
    form.isPaused,
  );
  const savedStatus = {
    paused: "Paused",
    open: "Open right now",
    closed: "Closed right now",
    unknown: "Status unavailable",
  }[presentation.savedService];
  const hasChanges =
    form.isPaused !== settings.isPaused ||
    form.pauseMessage !== (settings.pauseMessage ?? "") ||
    form.deliveryFeeEuros !== (settings.deliveryFee / 100).toFixed(2) ||
    DAYS.some(({ key }) => {
      const saved = settings.hours[key];
      const draft = form.hours[key];
      return (
        draft.closed !== (!saved.open || !saved.close) ||
        draft.open !== (saved.open ?? "10:00") ||
        draft.close !== (saved.close ?? "22:00")
      );
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Restaurant settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved service status, hours and delivery fee. All times use {appConfig.businessTimeZone}.
        </p>
      </div>

      <fieldset disabled={saving} className="min-w-0 space-y-6">
        <legend className="sr-only">Restaurant settings draft</legend>
        <section className="rounded-lg border border-border bg-background p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    presentation.savedService === "paused"
                      ? "danger"
                      : presentation.savedService === "open"
                        ? "success"
                        : "warning"
                  }
                >
                  {savedStatus} · Saved status
                </Badge>
                {presentation.draftPause !== null && (
                  <Badge tone="warning">
                    Unsaved {presentation.draftPause ? "pause" : "resume"}
                  </Badge>
                )}
              </div>
              <h2 className="text-lg font-semibold">New orders</h2>
              <p className="max-w-xl text-sm text-muted-foreground">
                When paused, customers see your message and cannot place orders. Changes take effect
                only after saving all settings.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
              <Label htmlFor="pause-orders">Pause new orders</Label>
              <Switch
                id="pause-orders"
                checked={form.isPaused}
                onCheckedChange={(v) => setForm((prev) => (prev ? { ...prev, isPaused: v } : prev))}
              />
            </div>
          </div>
          {presentation.draftPause !== null && (
            <p
              className="mt-3 text-sm font-medium text-amber-800 dark:text-amber-200"
              role="status"
            >
              {presentation.draftPause
                ? "Pause is a draft. The saved service status above still applies."
                : "Resume is a draft. New orders are still paused."}
            </p>
          )}
        </section>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-4 rounded-lg border border-border bg-background p-4 sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">Opening hours</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Outside these hours customers cannot order. A closing time earlier than opening
                continues into the next day.
              </p>
            </div>
            <div className="space-y-4">
              {DAYS.map(({ key, label }) => {
                const h = form.hours[key];
                const overnight =
                  !h.closed && isValidHoursPair(h.open, h.close) && h.close < h.open;
                return (
                  <div
                    key={key}
                    className="grid min-w-0 grid-cols-2 items-start gap-3 border-t border-border pt-4 sm:grid-cols-[minmax(5rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]"
                  >
                    <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:block sm:space-y-2">
                      <p className="text-sm font-semibold">{label}</p>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`${key}-open`}
                          checked={!h.closed}
                          onCheckedChange={(v) => setHour(key, "closed", !v)}
                          aria-label={`${label} open`}
                        />
                        <Label htmlFor={`${key}-open`} className="text-xs text-muted-foreground">
                          {h.closed ? "Closed" : "Open"}
                        </Label>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor={`${key}-opening`} className="text-xs">
                        <span className="sr-only">{label} </span>Opening
                      </Label>
                      <Input
                        id={`${key}-opening`}
                        type="time"
                        value={h.open}
                        disabled={h.closed}
                        onChange={(e) => setHour(key, "open", e.target.value)}
                        className="min-w-0 w-full font-mono"
                      />
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor={`${key}-closing`} className="text-xs">
                        <span className="sr-only">{label} </span>Closing
                      </Label>
                      <Input
                        id={`${key}-closing`}
                        type="time"
                        value={h.close}
                        disabled={h.closed}
                        onChange={(e) => setHour(key, "close", e.target.value)}
                        className="min-w-0 w-full font-mono"
                        aria-describedby={overnight ? `${key}-overnight` : undefined}
                      />
                      {overnight && (
                        <p
                          id={`${key}-overnight`}
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Next day
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="min-w-0 space-y-6">
            <section className="space-y-4 rounded-lg border border-border bg-background p-4 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold">Delivery fee</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Applied to delivery orders. Pickup has no delivery fee. Historical orders keep
                  their original fee.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="delivery-fee">Fee in {appConfig.currency}</Label>
                <Input
                  id="delivery-fee"
                  type="number"
                  step="0.10"
                  min="0"
                  max="100"
                  value={form.deliveryFeeEuros}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, deliveryFeeEuros: e.target.value } : prev))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Use Save settings below to apply this draft.
                </p>
              </div>
            </section>
            <section className="space-y-4 rounded-lg border border-border bg-background p-4 sm:p-6">
              <h2 className="text-lg font-semibold">Customer pause message</h2>
              <div className="space-y-2">
                <Label htmlFor="pauseMessage">Message shown while paused</Label>
                <Textarea
                  id="pauseMessage"
                  value={form.pauseMessage}
                  onChange={(e) =>
                    setForm((prev) => (prev ? { ...prev, pauseMessage: e.target.value } : prev))
                  }
                  placeholder={DEFAULT_PAUSE_MESSAGE}
                  maxLength={300}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank to use the default: "{DEFAULT_PAUSE_MESSAGE}"
                </p>
              </div>
            </section>
          </div>
        </div>
      </fieldset>

      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{formError}</span>
        </div>
      )}
      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-sm backdrop-blur">
        <p className="text-sm text-muted-foreground" role="status">
          {saving
            ? "Saving all settings…"
            : hasChanges
              ? "Unsaved changes · saved service status still applies"
              : "All changes saved"}
        </p>
        <Button onClick={handleSave} disabled={saving} className="min-h-11">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "danger" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "bg-green-600/10 text-green-700 border-green-600/30"
      : tone === "danger"
        ? "bg-destructive/10 text-destructive border-destructive/30"
        : "bg-yellow-500/10 text-yellow-700 border-yellow-500/30";
  return (
    <span
      className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${toneClass}`}
    >
      {children}
    </span>
  );
}
