import { io, Socket } from "socket.io-client";

/**
 * Single socket.io-client instance for the entire app.
 * Import this singleton wherever you need to emit or listen.
 *
 * Connection is lazy — the socket only opens when you first call
 * `.connect()` after setting up your event listeners.
 */
export const socket: Socket = io({
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});
