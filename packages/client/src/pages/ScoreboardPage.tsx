import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import confetti from "canvas-confetti";
import { socket } from "../lib/socketClient";

interface ScoreboardEntry {
  playerId: string;
  name: string;
  isYou: boolean;
  cardsLeft: number;
  score: number;
  isWinner: boolean;
}

const AVATAR_COLORS = ["#f2b341", "#4c6ef5", "#ef5b68", "#34c77b"];

function initials(name: string): string {
  return name.trim()[0].toUpperCase();
}

export default function ScoreboardPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { winnerId: string; scores: Record<string, number>; handCounts: Record<string, number> } | null;
  const [entries, setEntries] = useState<ScoreboardEntry[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [rematching, setRematching] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!roomId) return;

    // Request room state to determine host and player info
    socket.emit("room:requestState");

    function onRoomState(data: {
      players: Array<{ id: string; name: string; isBot: boolean; isReady: boolean }>;
      hostId: string;
      maxPlayers: number;
      theme: string;
    }) {
      setIsHost(data.hostId === socket.id);

      if (state) {
        const sorted = data.players
          .map((p) => {
            const isWinner = p.id === state.winnerId;
            return {
              playerId: p.id,
              name: p.name,
              isYou: p.id === socket.id,
              cardsLeft: (state.handCounts?.[p.id]) ?? (isWinner ? 0 : 1),
              score: state.scores[p.id] ?? 0,
              isWinner,
            };
          })
          .sort((a, b) => {
            // Winner first, then by score descending
            if (a.isWinner) return -1;
            if (b.isWinner) return 1;
            return b.score - a.score;
          });

        setEntries(sorted);
      }
    }

    socket.on("room:state", onRoomState);

    return () => {
      socket.off("room:state", onRoomState);
    };
  }, [roomId, state]);

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
      navigate(`/table/${roomId}`, { replace: true });
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
    navigate("/", { replace: true });
  }, [navigate, leaving]);

  const winner = entries.find((e) => e.isWinner);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
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
                  {entry.isWinner ? "0" : `+${entry.score}`}
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

          {isHost ? (
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
              Rematch → (host only)
            </button>
          )}
        </div>

        {!isHost && (
          <div className="text-center text-[12px] mt-3.5" style={{ color: "var(--ink-dim)" }}>
            Only the host can start a rematch — waiting on the host
          </div>
        )}
      </div>
    </div>
  );
}
