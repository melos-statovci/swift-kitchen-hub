import { appConfig } from "./config";
import { formatBusinessDateTime, formatBusinessTime } from "./businessTime";

const currencyFormatter = new Intl.NumberFormat(appConfig.locale, {
  style: "currency",
  currency: appConfig.currency,
});

export function formatCurrency(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

export function formatTime(iso: string): string {
  return formatBusinessTime(iso, appConfig.locale, appConfig.businessTimeZone);
}

export function formatDateTime(iso: string): string {
  return formatBusinessDateTime(iso, appConfig.locale, appConfig.businessTimeZone);
}

export function formatRelative(iso: string, nowMs: number = Date.now()): string {
  const diffSec = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  if (hr < 24) return remMin ? `${hr}h ${remMin}m ago` : `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
