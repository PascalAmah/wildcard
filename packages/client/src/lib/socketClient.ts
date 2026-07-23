import { io, Socket } from "socket.io-client";

/**
 * In development, Vite's proxy forwards /socket.io to localhost:3001.
 * In production, point VITE_SERVER_URL at the deployed server.
 */
const SERVER_URL = import.meta.env.VITE_SERVER_URL as string | undefined;

/**
 * Single socket.io-client instance for the entire app.
 * Import this singleton wherever you need to emit or listen.
 *
 * Connection is lazy — the socket only opens when you first call
 * `.connect()` after setting up your event listeners.
 */
export const socket: Socket = io(SERVER_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});

/**
 * Persist the current room code so we can rejoin after a socket reconnect.
 * Stored in sessionStorage so it survives page refreshes but not new tabs.
 */
export function persistRoomCode(code: string | null): void {
  if (code) {
    sessionStorage.setItem("wildcard_room", code);
  } else {
    sessionStorage.removeItem("wildcard_room");
  }
}

export function getStoredRoomCode(): string | null {
  return sessionStorage.getItem("wildcard_room");
}

/**
 * Store the original player ID assigned by the server on room join,
 * so we can re-use it after a socket reconnection to rejoin the room.
 */
export function persistPlayerId(playerId: string | null | undefined): void {
  if (playerId) {
    sessionStorage.setItem("wildcard_player_id", playerId);
  } else {
    sessionStorage.removeItem("wildcard_player_id");
  }
}

export function getStoredPlayerId(): string | null {
  return sessionStorage.getItem("wildcard_player_id");
}
