import { io, Socket } from "socket.io-client";
import { appConfig } from "./config";

const TOKEN_KEY = "sk_token";

let socket: Socket | null = null;

/**
 * Connect to the realtime server using the stored JWT.
 * Safe to call multiple times — returns the existing connection if there is one.
 *
 * Returns null if no token is stored (user not logged in).
 */
export function connectSocket(): Socket | null {
  // Already connected (or connecting) — reuse it
  if (socket) return socket;

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  socket = io(appConfig.apiUrl, {
    auth: { token },
    // Try WebSocket first, fall back to long-polling if it's blocked.
    transports: ["websocket", "polling"],
    // Reconnect with backoff if the connection drops.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  if (import.meta.env.DEV) {
    socket.on("connect", () => console.log("[socket] connected", socket?.id));
    socket.on("disconnect", (reason) => console.log("[socket] disconnected", reason));
    socket.on("connect_error", (err) => console.warn("[socket] connect_error:", err.message));
  }

  return socket;
}

/**
 * Disconnect and tear down the socket. Call on logout.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the current socket, if any. Returns null if not connected.
 */
export function getSocket(): Socket | null {
  return socket;
}
