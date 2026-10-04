export const appConfig = {
  restaurantName: import.meta.env.VITE_RESTAURANT_NAME ?? "Swift Kitchen Demo",
  currency: import.meta.env.VITE_CURRENCY ?? "EUR",
  locale: import.meta.env.VITE_LOCALE ?? "de-DE",
  businessTimeZone: import.meta.env.VITE_BUSINESS_TIMEZONE ?? "Europe/Belgrade",
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3001",
} as const;
