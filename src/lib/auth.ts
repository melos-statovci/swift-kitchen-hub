import { apiFetch } from "./api";
import { connectSocket, disconnectSocket } from "./socket";

export type Role = "admin" | "acceptance" | "kitchen" | "driver";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

const TOKEN_KEY = "sk_token";
const USER_KEY = "sk_user";

type LoginResponse = {
  token: string;
  user: User;
};

/**
 * Sign in against the real backend.
 * On success: stores token + user, opens the realtime socket, returns the user.
 */
export async function login(email: string, password: string): Promise<User> {
  const data = await apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: {
      email: email.toLowerCase().trim(),
      password,
    },
  });

  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));

  // Open the realtime connection now that we have a token.
  connectSocket();

  return data.user;
}

export function logout() {
  disconnectSocket();
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case "acceptance":
      return "/acceptance";
    case "kitchen":
      return "/kitchen";
    case "driver":
      return "/driver";
    case "admin":
      return "/admin";
  }
}

export function canAccess(
  role: Role,
  route: "acceptance" | "kitchen" | "driver" | "admin",
): boolean {
  if (role === "admin") return true;
  return role === route;
}
