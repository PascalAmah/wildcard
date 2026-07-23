import { useEffect, useState, useCallback, useRef } from "react";
import { socket } from "../lib/socketClient";

export type ConnectionState = "connected" | "connecting" | "lost";

/**
 * Exposes the socket connection state and a manual retry function.
 *
 * - `connected` — socket is actively connected
 * - `connecting` — initial connect or reconnecting after a drop
 * - `lost` — reconnection has failed 3+ times (manual retry shown)
 *
 * Drives the ConnectionLostOverlay per the designed error state.
 */
export function useSocket() {
  const [state, setState] = useState<ConnectionState>("connecting");
  const [attempt, setAttempt] = useState(0);
  const maxAttemptsBeforeManual = 3;
  const failedAttemptsRef = useRef(0);

  useEffect(() => {
    function onConnect() {
      setState("connected");
      failedAttemptsRef.current = 0;
      setAttempt(0);
    }

    function onDisconnect() {
      setState("connecting");
    }

    function onConnectError() {
      failedAttemptsRef.current += 1;
      setAttempt(failedAttemptsRef.current);

      if (failedAttemptsRef.current >= maxAttemptsBeforeManual) {
        setState("lost");
      } else {
        setState("connecting");
      }
    }

    function onReconnectAttempt() {
      setState("connecting");
    }

    function onReconnectFailed() {
      setState("lost");
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);

    // Open the connection if not already open
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
    };
  }, []);

  const manualRetry = useCallback(() => {
    failedAttemptsRef.current = 0;
    setAttempt(0);
    setState("connecting");
    socket.connect();
  }, []);

  return { state, attempt, maxAttemptsBeforeManual, manualRetry };
}
