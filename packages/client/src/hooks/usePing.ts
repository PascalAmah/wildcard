import { useEffect, useRef, useState } from "react";
import { socket } from "../lib/socketClient";

export type PingQuality = "good" | "ok" | "poor" | "idle";

export interface PingState {
  latency: number | null; // ms, null until first measurement
  quality: PingQuality;
}

const PING_INTERVAL_MS = 5000;
const GOOD_THRESHOLD = 150;
const OK_THRESHOLD = 350;

/**
 * Measures socket round-trip latency by sending periodic pings.
 * Returns { latency, quality } for display.
 *
 * quality thresholds:
 *   good — ≤150ms
 *   ok   — ≤350ms
 *   poor — >350ms
 *   idle — no measurement yet
 */
export function usePing(): PingState {
  const [latency, setLatency] = useState<number | null>(null);
  const pingSentAt = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    function onPong() {
      const rtt = Date.now() - pingSentAt.current;
      setLatency(rtt);
    }

    socket.on("pong", onPong);

    // Send first ping immediately, then every PING_INTERVAL_MS
    function sendPing() {
      pingSentAt.current = Date.now();
      socket.emit("ping");
    }

    sendPing();
    intervalRef.current = setInterval(sendPing, PING_INTERVAL_MS);

    return () => {
      socket.off("pong", onPong);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const quality: PingQuality =
    latency === null ? "idle"
    : latency <= GOOD_THRESHOLD ? "good"
    : latency <= OK_THRESHOLD ? "ok"
    : "poor";

  return { latency, quality };
}
