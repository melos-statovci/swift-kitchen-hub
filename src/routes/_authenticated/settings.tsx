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
  const { settings, openStatus, loading, error: loadError, saving, save } = useSettings();
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Hydrate form when settings arrive
  useEffect(() => {
    if (!settings) return;
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

  if (loading || !form) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading settings…</p>
      </div>
    );
  }

  if (loadError) {
    return <div className="text-center py-20 text-destructive">{loadError}</div>;
  }

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
    if (!form) return;
    setFormError(null);

    // Validate delivery fee
    const fee = Number(form.deliveryFeeEuros);
    if (Number.isNaN(fee) || fee < 0 || fee > 100) {
      setFormError("Delivery fee must be between 0 and 100 euros.");
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
      if (err instanceof NetworkError) {
        toast.error("Could not reach the server.");
      } else if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Failed to save settings.");
      }
    }
  };

  const statusBadge = (() => {
    if (form.isPaused) {
      return <Badge tone="danger">Paused</Badge>;
    }
    if (!openStatus) return null;
    if (openStatus.isOpen) return <Badge tone="success">Open right now</Badge>;
    return <Badge tone="warning">Closed right now</Badge>;
  })();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold tracking-tight">Restaurant settings</h1>
          {statusBadge}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Hours, delivery fee, and pause control. All times are in local time (Prishtina).
        </p>
      </div>

      {/* Pause section */}
      <section className="space-y-4 border border-border rounded-lg p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Pause new orders</h2>
            <p className="text-sm text-muted-foreground mt-1">
              When paused, customers see a message and can't place orders. Use this when you're
              slammed.
            </p>
          </div>
          <Switch
            checked={form.isPaused}
            onCheckedChange={(v) => setForm((prev) => (prev ? { ...prev, isPaused: v } : prev))}
          />
        </div>

        {form.isPaused && (
          <div className="space-y-2">
            <Label htmlFor="pauseMessage">Message for customers</Label>
            <Textarea
              id="pauseMessage"
              value={form.pauseMessage}
              onChange={(e) =>
                setForm((prev) => (prev ? { ...prev, pauseMessage: e.target.value } : prev))
              }
              placeholder={DEFAULT_PAUSE_MESSAGE}
              maxLength={300}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the default: "{DEFAULT_PAUSE_MESSAGE}"
            </p>
          </div>
        )}
      </section>

      {/* Delivery fee */}
      <section className="space-y-4 border border-border rounded-lg p-6">
        <div>
          <h2 className="text-lg font-semibold">Delivery fee</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Charged on every order. Historical orders keep their original fee.
          </p>
        </div>
        <div className="flex items-center gap-2 max-w-[180px]">
          <Input
            type="number"
            step="0.10"
            min="0"
            max="100"
            value={form.deliveryFeeEuros}
            onChange={(e) =>
              setForm((prev) => (prev ? { ...prev, deliveryFeeEuros: e.target.value } : prev))
            }
          />
          <span className="text-sm text-muted-foreground">€</span>
        </div>
      </section>

      {/* Opening hours */}
      <section className="space-y-4 border border-border rounded-lg p-6">
        <div>
          <h2 className="text-lg font-semibold">Opening hours</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Outside these hours, customers see a "closed" banner and can't order. A closing time
            earlier than opening means service continues overnight.
          </p>
        </div>

        <div className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const h = form.hours[key];
            return (
              <div
                key={key}
                className="grid grid-cols-1 md:grid-cols-[120px_auto_1fr_1fr] items-center gap-3"
              >
                <span className="font-medium text-sm">{label}</span>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`${key}-open`}
                    checked={!h.closed}
                    onCheckedChange={(v) => setHour(key, "closed", !v)}
                  />
                  <Label htmlFor={`${key}-open`} className="text-xs text-muted-foreground">
                    {h.closed ? "Closed" : "Open"}
                  </Label>
                </div>
                <Input
                  type="time"
                  value={h.open}
                  disabled={h.closed}
                  onChange={(e) => setHour(key, "open", e.target.value)}
                  className="font-mono"
                />
                <Input
                  type="time"
                  value={h.close}
                  disabled={h.closed}
                  onChange={(e) => setHour(key, "close", e.target.value)}
                  className="font-mono"
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Form error + save */}
      {formError && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded p-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save changes
            </>
          )}
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
