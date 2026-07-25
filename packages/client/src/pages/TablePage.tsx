import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { CardColor } from "@wildcard/shared";
import { socket } from "../lib/socketClient";
import { useGameState } from "../hooks/useGameState";
import type { GameView } from "../hooks/useGameState";
import { isReducedMotion } from "../lib/gsapConfig";
import DiscardPile from "../components/table/DiscardPile";
import type { DiscardPileHandle } from "../components/table/DiscardPile";
import DrawPile from "../components/table/DrawPile";
import Hand, { executeFlyToDiscard } from "../components/table/Hand";
import OpponentRow from "../components/table/OpponentRow";
import WildColorPicker from "../components/table/WildColorPicker";
import ReconnectOverlay from "../components/table/ReconnectOverlay";
import Toast from "../components/shared/Toast";
import type { ToastMessage } from "../components/shared/Toast";
import { persistRoomCode, persistPlayerId } from "../lib/socketClient";
import { usePing } from "../hooks/usePing";

const ROUND_RESULT_KEY = "wildcard_round_result";

// ---------- helpers ----------

interface GameEvent {
  type: string;
  actorId: string;
  cardId?: string;
  message: string;
}

interface DisconnectPayload {
  playerId: string;
  playerName: string;
  countdown: number;
}

// ---------- component ----------

export default function TablePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { state, dispatch } = useGameState();

  // ----- Derived state -----
  const view =
    state.screen === "playing"
      ? (state as { screen: "playing"; view: GameView; myPlayerId: string }).view
      : null;
  const myPlayerId =
    state.screen === "playing"
      ? (state as { screen: "playing"; view: GameView; myPlayerId: string }).myPlayerId
      : "";

  // ----- Refs -----
  const discardPileRef = useRef<DiscardPileHandle>(null);
  const drawPileRef = useRef<HTMLDivElement>(null);

  // ----- Local UI state -----
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);
  const [actingPlayerId, setActingPlayerId] = useState<string | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{
    playerId: string;
    playerName: string;
    countdown: number;
  } | null>(null);

  // Track last-played card ID so we can restore it on server rejection
  const [rejectedCardId, setRejectedCardId] = useState<string | null>(null);
  const lastPlayedCardIdRef = useRef<string | null>(null);

  const { quality: pingQuality, latency: pingMs } = usePing();

  // Turn pulse: bump key when isMyTurn changes → CSS animation re-triggers
  const [turnKey, setTurnKey] = useState(0);
  const isMyTurn = view
    ? view.currentPlayerIndex === view.players.findIndex((p) => p.id === myPlayerId)
    : false;
  useEffect(() => {
    setTurnKey((k) => k + 1);
  }, [isMyTurn]);

  const toastCounter = useRef(0);
  const myPlayerIdRef = useRef(myPlayerId);
  myPlayerIdRef.current = myPlayerId;

  // Clear actingPlayerId after animation completes
  const actingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ----- Socket event listeners -----
  useEffect(() => {
    if (!roomId) return;

    function onGameEvent(event: GameEvent) {
      const id = `toast-${++toastCounter.current}`;
      setToasts((prev) => [...prev, { id, message: event.message, type: "info" as const }]);

      // Trigger opponent action animation — skip for my own actions
      if (event.actorId !== myPlayerIdRef.current) {
        setActingPlayerId(event.actorId);
        if (actingTimerRef.current) clearTimeout(actingTimerRef.current);
        actingTimerRef.current = setTimeout(() => setActingPlayerId(null), 800);
      }
    }

    function onError(err: { code: string; message: string }) {
      const id = `toast-${++toastCounter.current}`;
      setToasts((prev) => [
        ...prev,
        { id, message: err.message || `Error: ${err.code}`, type: "error" as const },
      ]);

      // If the server rejected a play we just attempted, restore the card
      // that was dimmed by the optimistic fly-to-discard animation.
      if (
        (err.code === "NOT_YOUR_TURN" || err.code === "ILLEGAL_MOVE") &&
        lastPlayedCardIdRef.current
      ) {
        setRejectedCardId(lastPlayedCardIdRef.current);
        lastPlayedCardIdRef.current = null;
      }
    }

    function onPlayerDisconnected(payload: DisconnectPayload) {
      setDisconnectedPlayer({
        playerId: payload.playerId,
        playerName: payload.playerName,
        countdown: payload.countdown,
      });
    }

    function onPlayerReconnected(payload: { playerId: string }) {
      setDisconnectedPlayer((prev) =>
        prev?.playerId === payload.playerId ? null : prev,
      );
    }

    socket.on("game:event", onGameEvent);
    socket.on("error", onError);
    socket.on("player:disconnected", onPlayerDisconnected);
    socket.on("player:reconnected", onPlayerReconnected);

    // Request fresh state on mount
    socket.emit("room:requestState");

    return () => {
      socket.off("game:event", onGameEvent);
      socket.off("error", onError);
      socket.off("player:disconnected", onPlayerDisconnected);
      socket.off("player:reconnected", onPlayerReconnected);
    };
  }, [roomId]);

  // Update theme whenever view changes
  useEffect(() => {
    if (view?.theme) {
      document.body.dataset.theme = view.theme;
    }
  }, [view?.theme]);

  // ----- Countdown for reconnect overlay -----
  useEffect(() => {
    if (!disconnectedPlayer || disconnectedPlayer.countdown <= 0) return;

    const interval = setInterval(() => {
      setDisconnectedPlayer((prev) => {
        if (!prev) return null;
        const next = prev.countdown - 1;
        if (next <= 0) return null;
        return { ...prev, countdown: next };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [disconnectedPlayer?.playerId, disconnectedPlayer?.countdown]);

  // ----- Toast management -----
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ----- Game actions -----

  function handlePlayCard(cardId: string, chosenColor?: CardColor) {
    if (!roomId || !view) return;

    const card = view.myHand.find((c) => c.id === cardId);
    if (
      card &&
      (card.type === "WILD" || card.type === "WILD_DRAW_FOUR") &&
      card.color === null &&
      !chosenColor
    ) {
      setPendingWildCardId(cardId);
      return;
    }

    lastPlayedCardIdRef.current = cardId;
    setRejectedCardId(null);
    socket.emit("game:playCard", { roomId, cardId, chosenColor });
  }

  function handleWildColorChosen(color: CardColor) {
    if (!pendingWildCardId || !roomId) return;

    const targetEl = discardPileRef.current?.cardEl ?? null;

    // Fly the card to discard pile, then emit
    executeFlyToDiscard(pendingWildCardId, targetEl, () => {
      lastPlayedCardIdRef.current = pendingWildCardId;
      setRejectedCardId(null);
      socket.emit("game:playCard", {
        roomId,
        cardId: pendingWildCardId,
        chosenColor: color,
      });
      setPendingWildCardId(null);
    });
  }

  function handleDraw() {
    if (!roomId) return;
    socket.emit("game:drawCard", { roomId });
  }

  // ---- Game actions ----
  // ----- Reconnect handlers -----
  function handleRetry() {
    socket.connect();
    if (roomId) {
      socket.emit("room:requestState");
    }
  }

  function handlePlayWithout() {
    if (!disconnectedPlayer || !roomId) return;
    socket.emit("game:playWithout", { roomId, playerId: disconnectedPlayer.playerId });
    setDisconnectedPlayer(null);
  }

  // ----- Animation: table entrance -----
  const tableRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!tableRef.current) return;

      // Respect OS reduced-motion preference — skip animation entirely
      if (isReducedMotion()) return;

      const tl = gsap.from(tableRef.current.children, {
        y: 30,
        opacity: 0,
        duration: 0.4,
        stagger: 0.06,
        ease: "power2.out",
      });

      // Return the kill function so useGSAP calls it on cleanup/deps change
      return () => tl.kill();
    },
    { scope: tableRef, dependencies: [!!view] },
  );

  // ----- Store last known game view for round-over navigation -----
  // When screen transitions from "playing" to "roundOver", view becomes null,
  // but we still need the players array to pass to the scoreboard.
  const lastViewRef = useRef<typeof view>(null);
  if (view) lastViewRef.current = view;

  // ----- Screen-based redirects -----
  useEffect(() => {
    if (state.screen === "roundOver" && lastViewRef.current) {
      const data = state as { screen: "roundOver"; winnerId: string; scores: Record<string, number>; handCounts: Record<string, number> };
      const players = lastViewRef.current.players;
      const roundData = {
        winnerId: data.winnerId,
        scores: data.scores,
        handCounts: data.handCounts,
        players,
      };
      // Persist to sessionStorage so the scoreboard survives page refresh
      try {
        sessionStorage.setItem(ROUND_RESULT_KEY, JSON.stringify(roundData));
      } catch { /* sessionStorage may be unavailable */ }
      setTimeout(() => {
        navigate(`/table/${roomId}/results`, {
          state: roundData,
        });
      }, 2000);
    } else if (state.screen === "waiting" || state.screen === "lobby") {
      if (roomId) {
        navigate(`/table/${roomId}/waiting`);
      }
    }
  }, [state.screen, roomId, navigate]);

  // ----- Loading state with CSS-driven progress bar -----
  // The bar fills 0→100% over 2s via CSS animation (fillBar keyframe).
  // We keep the loader visible for at least LOAD_MIN_MS for a smooth
  // transition, then reveal the game once view is available.
  const [showLoader, setShowLoader] = useState(true);
  const [loaderKey, setLoaderKey] = useState(0);
  const mountedAt = useRef(Date.now());
  const LOAD_DURATION_MS = 2000;
  const LOAD_MIN_MS = LOAD_DURATION_MS; // bar reaches 100% before game appears

  // When view becomes available, wait for minimum display time then reveal
  useEffect(() => {
    if (!view || !showLoader) return;
    const remaining = Math.max(0, LOAD_MIN_MS - (Date.now() - mountedAt.current));
    const timer = setTimeout(() => setShowLoader(false), remaining);
    return () => clearTimeout(timer);
  }, [view, showLoader]);

  // Auto-retry if view still isn't available
  useEffect(() => {
    if (view || !roomId || !showLoader) return;
    const timer = setTimeout(() => {
      socket.emit("room:requestState");
      mountedAt.current = Date.now();
      setLoaderKey((k) => k + 1);
    }, LOAD_DURATION_MS + 300);
    return () => clearTimeout(timer);
  }, [view, roomId, showLoader]);

  if (showLoader) {

    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="flex flex-col items-center gap-5">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-[14px] h-[14px] rounded-[4px] rotate-[8deg] bg-[conic-gradient(from_45deg,#34c77b,#f2b341,#ef5b68,#4c6ef5,#34c77b)]" />
            <span
              className="font-bold text-[20px]"
              style={{ fontFamily: "'Fredoka', sans-serif" }}
            >
              Wildcard
            </span>
          </div>

          {/* Determinate progress bar — animated entirely via CSS */}
          <div
            className="w-[200px] h-[3px] rounded-full overflow-hidden"
            style={{ background: "var(--line)" }}
          >
            <div
              className="h-full rounded-full"
              key={loaderKey}
              style={{
                background:
                  "linear-gradient(90deg, var(--accent) 0%, var(--green) 100%)",
                animation: "fillBar 2s ease-out forwards",
                transformOrigin: "left center",
                width: "100%",
                transform: "scaleX(0)",
              }}
            />
          </div>

          {/* Label */}
          <p className="text-[13px] text-[var(--ink-dim)]">
            Connecting to your table…
          </p>

          {/* Manual retry */}
          <button
            onClick={() => {
              mountedAt.current = Date.now();
              setLoaderKey((k) => k + 1);
              socket.emit("room:requestState");
            }}
            className="text-[12px] text-[var(--ink-dim)] font-semibold cursor-pointer bg-transparent underline border-none"
          >
            Taking too long? Tap to retry
          </button>
        </div>
      </div>
    );
  }

  // Guard: if we're transitioning to round-over (player left mid-game),
  // don't render the game table — the redirect effect will navigate to
  // the scoreboard shortly.
  if (state.screen === "roundOver") {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="flex flex-col items-center gap-3">
          <span className="text-[14px] font-semibold text-[var(--ink-dim)]">
            Round over…
          </span>
        </div>
      </div>
    );
  }

  if (!view) return null;

  const topCard = view.topCard;
  const discardCardEl = discardPileRef.current?.cardEl ?? null;

  function handleLeave() {
    socket.emit("room:leave");
    persistRoomCode(null);
    persistPlayerId(null);
    dispatch({ type: "GO_TO_LANDING" });
    navigate("/", { replace: true });
  }

  return (
    <div
      ref={tableRef}
      className="h-full flex flex-col items-center justify-between p-4 pb-8 relative overflow-x-hidden overflow-y-visible"
      style={{ background: "var(--bg)" }}
    >
      {/* Background glow */}
      <div
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "var(--bg-glow-1)" }}
      />

      {/* Top bar with room code and leave button */}
      <div className="relative z-10 w-full max-w-[800px] flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink-dim)]">
          {/* Ping indicator */}
          <span
            className="w-[6px] h-[6px] rounded-full shrink-0"
            style={{
              background:
                pingQuality === "good" ? "var(--green)"
                : pingQuality === "ok" ? "var(--yellow)"
                : pingQuality === "poor" ? "var(--red)"
                : "var(--line)",
            }}
            title={pingMs != null ? `${pingMs}ms` : "Measuring…"}
          />
          Table <b className="text-[var(--ink)]">{roomId}</b>
          <span className="text-[var(--line)] mx-1">·</span>
          {view.players.length} player{view.players.length !== 1 ? "s" : ""}
        </div>

        <button
          onClick={handleLeave}
          className="text-[12px] font-semibold text-[var(--ink-dim)] bg-transparent border border-[var(--line)] rounded-lg px-3 py-1 cursor-pointer hover:text-[var(--red)] hover:border-[var(--red)] transition-colors duration-200"
        >
          Leave
        </button>
      </div>

      {/* Opponents row */}
      <div className="relative z-10 w-full max-w-[800px]">
        <OpponentRow
          players={view.players}
          currentPlayerIndex={view.currentPlayerIndex}
          myPlayerId={myPlayerId}
          actingPlayerId={actingPlayerId}
        />
      </div>

      {/* Center area: discard + draw piles */}
      <div className="relative z-10 flex items-center gap-12">
        <DiscardPile ref={discardPileRef} topCard={topCard} activeColor={view.activeColor} />
        <DrawPile
          ref={drawPileRef}
          drawPileCount={view.drawPileCount}
          onDraw={handleDraw}
          canDraw={isMyTurn}
        />
      </div>

      {/* Turn info and direction */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <span
          key={turnKey}
          className={`text-[13px] font-bold px-5 py-1.5 rounded-full transition-all duration-300 ${
            isMyTurn
              ? "bg-[var(--accent)] text-white shadow-[0_0_14px_var(--accent)]"
              : "bg-[var(--panel-2)] text-[var(--ink-dim)] border border-[var(--line)]"
          }`}
          style={{ animation: "turnPulse 0.4s ease-out" }}
        >
          {isMyTurn
            ? "Your turn"
            : `${view.players[view.currentPlayerIndex]?.name ?? "Opponent"}'s turn`}
        </span>

        <div className="text-[11px] text-[var(--ink-dim)]">
          {view.direction === 1 ? "\u2192 Clockwise" : "\u2190 Counter-clockwise"}
        </div>
      </div>

      {/* Player's hand */}
      <div className="relative z-10 w-full max-w-full px-2">
        <Hand
          cards={view.myHand}
          onPlayCard={handlePlayCard}
          activeColor={view.activeColor}
          topCard={topCard}
          isMyTurn={isMyTurn}
          discardPileEl={discardCardEl}
          drawPileEl={drawPileRef.current}
          rejectedCardId={rejectedCardId}
          onIllegalPlay={() => {}}
          onToast={(msg) => {
            const id = `toast-${++toastCounter.current}`;
            setToasts((prev) => [...prev, { id, ...msg }]);
          }}
        />
      </div>

      {/* Wild color picker */}
      {pendingWildCardId && (
        <WildColorPicker
          onChooseColor={handleWildColorChosen}
          onCancel={() => setPendingWildCardId(null)}
        />
      )}

      {/* Reconnect overlay */}
      {disconnectedPlayer && (
        <ReconnectOverlay
          disconnectedPlayerId={disconnectedPlayer.playerId}
          disconnectedPlayerName={disconnectedPlayer.playerName}
          countdown={disconnectedPlayer.countdown}
          isMe={disconnectedPlayer.playerId === myPlayerId}
          onRetry={handleRetry}
          onPlayWithout={handlePlayWithout}
        />
      )}

      {/* Toast notifications */}
      <Toast messages={toasts} onDismiss={dismissToast} />
    </div>
  );
}
