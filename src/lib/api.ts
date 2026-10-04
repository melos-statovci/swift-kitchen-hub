// Tiny API client that handles base URL, JSON parsing, and Bearer auth.
// Swap point: every component that talks to the backend goes through this.

import { appConfig } from "./config";

const TOKEN_KEY = "sk_token";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class NetworkError extends Error {
  constructor() {
    super("Could not reach the server. Is the backend running?");
    this.name = "NetworkError";
  }
}

type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${appConfig.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    // fetch only throws on network errors or aborts. Treat as network error.
    throw new NetworkError();
  }

  // Try to parse JSON; if it fails, fall back to text.
  let parsed: unknown = null;
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    parsed = await res.json().catch(() => null);
  } else {
    parsed = await res.text().catch(() => null);
  }

  if (!res.ok) {
    const message =
      (parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error: unknown }).error === "string"
        ? (parsed as { error: string }).error
        : null) ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, parsed, message);
  }

  return parsed as T;
}
