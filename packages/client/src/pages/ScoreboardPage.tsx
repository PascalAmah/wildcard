import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import confetti from "canvas-confetti";
import { socket, persistRoomCode, persistPlayerId, getStoredPlayerId } from "../lib/socketClient";
import { useGameState } from "../hooks/useGameState";

interface ScoreboardEntry {
  playerId: string;
  name: string;
  isYou: boolean;
  cardsLeft: number;
  score: number;
  isWinner: boolean;
}

const AVATAR_COLORS = ["#f2b341", "#4c6ef5", "#ef5b68", "#34c77b"];
const STORAGE_KEY = "wildcard_round_result";

function initials(name: string): string {
  return name.trim()[0].toUpperCase();
}

interface RoundResultData {
  winnerId: string;
  scores: Record<string, number>;
  handCounts: Record<string, number>;
  players: Array<{ id: string; name: string; isBot: boolean; handCount: number }>;
}

function getStoredRoundResult(): RoundResultData | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearStoredRoundResult(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export default function ScoreboardPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { dispatch } = useGameState();
  const locationState = location.state as RoundResultData | null;
  const storedResult = !locationState ? getStoredRoundResult() : null;
  const [entries, setEntries] = useState<ScoreboardEntry[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [rematching, setRematching] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [loading, setLoading] = useState(!locationState && !storedResult);
  const confettiFired = useRef(false);

  function buildEntries(data: RoundResultData): ScoreboardEntry[] {
    return data.players
      .map((p) => {
        const isWinner = p.id === data.winnerId;
        return {
          playerId: p.id,
          name: p.name,
          isYou: p.id === socket.id || p.id === getStoredPlayerId(),
          cardsLeft: data.handCounts?.[p.id] ?? (isWinner ? 0 : 1),
          score: data.scores[p.id] ?? 0,
          isWinner,
        };
      })
      .sort((a, b) => {
        if (a.isWinner) return -1;
        if (b.isWinner) return 1;
        return b.score - a.score;
      });
  }

  // Build entries from navigation state or sessionStorage
  useEffect(() => {
    const source = locationState ?? storedResult;
    if (!source) return;

    const sorted = buildEntries(source);
    setEntries(sorted);
    setLoading(false);
  }, [locationState]);

  // Determine if this player is the host. On page refresh, the socket
  // reconnects via room:rejoin which now always sends room:state with hostId.
  // We retry a few times to handle any edge cases with async rejoin timing.
  useEffect(() => {
    if (!roomId) return;

    const storedId = getStoredPlayerId();
    let retries = 0;
    const maxRetries = 4;

    function onRoomState(data: { hostId: string; players: Array<unknown> }) {
      setIsHost(data.hostId === storedId);
      setPlayerCount(data.players.length);
    }

    socket.on("room:state", onRoomState);

    function poll() {
      socket.emit("room:requestState");
      if (retries < maxRetries) {
        retries++;
        setTimeout(poll, 400);
      }
    }

    poll();

    return () => {
      retries = maxRetries;
      socket.off("room:state", onRoomState);
    };
  }, [roomId]);

  // Fire confetti on mount (once)
  useEffect(() => {
    if (confettiFired.current) return;
    confettiFired.current = true;

    // Fire from both sides
    const defaults = { spread: 60, ticks: 80, gravity: 0.6, decay: 0.94, startVelocity: 30 };

    confetti({ ...defaults, particleCount: 40, origin: { x: 0.2, y: 0.5 }, angle: 60 });
    confetti({ ...defaults, particleCount: 40, origin: { x: 0.8, y: 0.5 }, angle: 120 });

    // A bigger burst after a brief delay
    setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { x: 0.5, y: 0.4 },
        startVelocity: 40,
        gravity: 0.5,
        decay: 0.92,
      });
    }, 300);
  }, []);

  // Listen for game:rematch to navigate back to the table
  useEffect(() => {
    function onRematch() {
      setRematching(false);
      navigate(`/table/${roomId}`, { replace: true, state: { fromRematch: true } });
    }

    socket.on("game:rematch", onRematch);
    return () => {
      socket.off("game:rematch", onRematch);
    };
  }, [roomId, navigate]);

  const handleRematch = useCallback(() => {
    if (!roomId || rematching) return;
    setRematching(true);
    socket.emit("room:rematch", { roomId });
  }, [roomId, rematching]);

  const handleLeave = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    // Clear stored room/player so the app doesn't try to rejoin on next visit
    persistRoomCode(null);
    persistPlayerId(null);
    clearStoredRoundResult();
    // Reset game state back to landing so the lobby doesn't auto-redirect
    dispatch({ type: "GO_TO_LANDING" });
    navigate("/", { replace: true });
  }, [navigate, leaving, dispatch]);

  const winner = entries.find((e) => e.isWinner);
  // Use the server-reported player count to determine if rematch is possible.
  // When a player leaves mid-game, entries may still show 2 players from
  // cached state, but the server's room:state has the updated count.
  const actualPlayerCount = playerCount > 0 ? playerCount : entries.length;
  const canRematch = isHost && actualPlayerCount >= 2;

  if (loading) {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <span className="text-[14px] font-semibold text-[var(--ink-dim)]">
            Loading results…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full overflow-auto flex items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(1000px 600px at 50% -6%, rgba(52,199,123,0.16) 0%, transparent 60%), var(--bg)",
        color: "var(--ink)",
      }}
    >
      <div className="w-full max-w-[560px]">
        {/* Winner banner */}
        <div className="text-center mb-7">
          <div
            className="w-16 h-16 rounded-[20px] mx-auto mb-4 flex items-center justify-center"
            style={{
              background:
                "conic-gradient(from 45deg, var(--green), var(--yellow), var(--red), var(--blue), var(--green))",
              boxShadow: "0 16px 32px -8px rgba(242,179,61,0.35)",
            }}
          >
            <span className="text-[28px]">🏆</span>
          </div>
          <div className="text-[12.5px] font-bold text-[var(--ink-dim)] uppercase tracking-wide mb-1.5">
            Round over
          </div>
          <h1
            className="font-[Fredoka,sans-serif] font-semibold text-[28px]"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
          >
            <span style={{ color: "var(--green)" }}>{winner?.name ?? "Unknown"}</span> wins this round
          </h1>
        </div>

        {/* Scoreboard */}
        <div
          className="rounded-[20px] p-[10px] mb-[22px]"
          style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
        >
          {entries.map((entry, i) => (
            <div key={entry.playerId}>
              <div
                className="flex items-center gap-3.5 px-[18px] py-[14px] rounded-[14px]"
                style={
                  entry.isWinner
                    ? { background: "rgba(52,199,123,0.08)" }
                    : undefined
                }
              >
                <span
                  className="font-[Fredoka,sans-serif] font-semibold text-[15px] w-5 text-center shrink-0"
                  style={{
                    fontFamily: "'Fredoka', sans-serif",
                    color: entry.isWinner ? "var(--green)" : "var(--ink-dim)",
                  }}
                >
                  {i + 1}
                </span>
                <div
                  className="w-[38px] h-[38px] rounded-full shrink-0 flex items-center justify-center text-white font-[Fredoka,sans-serif] font-semibold text-[14px]"
                  style={{
                    fontFamily: "'Fredoka', sans-serif",
                    background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  }}
                >
                  {initials(entry.name)}
                </div>
                <div className="flex-1 font-bold text-[14.5px] flex items-center gap-2">
                  <div>
                    {entry.isYou ? "You" : entry.name}
                    {entry.isYou && (
                      <span
                        className="text-[10px] font-bold uppercase ml-1.5 px-2 py-0.5 rounded-full"
                        style={{
                          color: "var(--blue)",
                          background: "rgba(76,110,245,0.14)",
                          border: "1px solid rgba(76,110,245,0.35)",
                        }}
                      >
                        You
                      </span>
                    )}
                    <div className="text-[12.5px] text-[var(--ink-dim)] font-normal">
                      {entry.isWinner
                        ? "Emptied their hand first"
                        : `${entry.cardsLeft} card${entry.cardsLeft === 1 ? "" : "s"} left`}
                    </div>
                  </div>
                </div>
                <span
                  className="font-[Fredoka,sans-serif] font-semibold text-[17px] min-w-[44px] text-right"
                  style={{
                    fontFamily: "'Fredoka', sans-serif",
                    color: entry.isWinner ? "var(--green)" : undefined,
                  }}
                >
                  +{entry.score}
                </span>
              </div>
              {i < entries.length - 1 && (
                <div className="h-[1px] mx-[14px]" style={{ background: "var(--line)" }} />
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="flex-1 rounded-xl py-[15px] px-5 font-bold text-[15px] cursor-pointer transition-transform duration-[180ms] ease-out disabled:opacity-50"
            style={{
              background: "var(--panel-2)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
            }}
          >
            {leaving ? "Leaving…" : "Leave table"}
          </button>

          {canRematch ? (
            <button
              onClick={handleRematch}
              disabled={rematching}
              className="flex-1 rounded-xl py-[15px] px-5 font-bold text-[15px] cursor-pointer transition-transform duration-[180ms] ease-out disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, var(--red), #d94655)",
                color: "#fff",
                boxShadow: "0 12px 26px rgba(239,91,104,0.28)",
              }}
            >
              {rematching ? "Dealing a new round…" : "Rematch →"}
            </button>
          ) : (
            <button
              disabled
              className="flex-1 rounded-xl py-[15px] px-5 font-bold text-[15px] opacity-50 cursor-not-allowed"
              style={{
                background: "var(--panel-2)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
              }}
            >
              {actualPlayerCount < 2 ? "Not enough players" : "Rematch → (host only)"}
            </button>
          )}
        </div>

        {isHost && actualPlayerCount < 2 ? (
          <div className="text-center text-[12px] mt-3.5" style={{ color: "var(--ink-dim)" }}>
            Waiting for more players to join before rematch
          </div>
        ) : !isHost ? (
          <div className="text-center text-[12px] mt-3.5" style={{ color: "var(--ink-dim)" }}>
            Only the host can start a rematch — waiting on the host
          </div>
        ) : null}
      </div>
    </div>
  );
}
