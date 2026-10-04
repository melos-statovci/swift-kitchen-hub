/** Format stored UTC instants in the restaurant's configured local clock. */
export function formatBusinessTime(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatBusinessDateTime(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
