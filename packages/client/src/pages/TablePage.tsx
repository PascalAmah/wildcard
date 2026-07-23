import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { CardColor } from "@wildcard/shared";
import { socket } from "../lib/socketClient";
import { useGameState } from "../hooks/useGameState";
import type { GameView } from "../hooks/useGameState";
import DiscardPile from "../components/table/DiscardPile";
import DrawPile from "../components/table/DrawPile";
import Hand from "../components/table/Hand";
import OpponentRow from "../components/table/OpponentRow";
import WildColorPicker from "../components/table/WildColorPicker";
import ReconnectOverlay from "../components/table/ReconnectOverlay";
import Toast from "../components/shared/Toast";
import type { ToastMessage } from "../components/shared/Toast";

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
  const { state } = useGameState();

  // ----- Derived state -----
  const view = state.screen === "playing" ? (state as { screen: "playing"; view: GameView; myPlayerId: string }).view : null;
  const myPlayerId = state.screen === "playing" ? (state as { screen: "playing"; view: GameView; myPlayerId: string }).myPlayerId : "";

  // ----- Local UI state -----
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{
    playerId: string;
    playerName: string;
    countdown: number;
  } | null>(null);
  // Flag to avoid showing wild picker during fly animation — we handle it in Hand
  const [, setAwaitingWildColor] = useState(false);

  const toastCounter = useRef(0);

  // ----- Socket event listeners -----
  useEffect(() => {
    if (!roomId) return;

    // Note: game:state is handled by GameStateProvider (useGameState.tsx).
    // We only listen for ancillary events here.

    // Listen for game events (toast messages)
    function onGameEvent(event: GameEvent) {
      const id = `toast-${++toastCounter.current}`;
      const msg: ToastMessage = {
        id,
        message: event.message,
        type: "info" as const,
      };
      setToasts((prev) => [...prev, msg]);
    }

    // Listen for errors
    function onError(err: { code: string; message: string }) {
      const id = `toast-${++toastCounter.current}`;
      const msg: ToastMessage = {
        id,
        message: err.message || `Error: ${err.code}`,
        type: "error" as const,
      };
      setToasts((prev) => [...prev, msg]);
    }

    // Listen for player disconnection
    function onPlayerDisconnected(payload: DisconnectPayload) {
      setDisconnectedPlayer({
        playerId: payload.playerId,
        playerName: payload.playerName,
        countdown: payload.countdown,
      });
    }

    // Listen for player reconnection (clear overlay)
    function onPlayerReconnected(payload: { playerId: string }) {
      setDisconnectedPlayer((prev) =>
        prev?.playerId === payload.playerId ? null : prev,
      );
    }

    socket.on("game:event", onGameEvent);
    socket.on("error", onError);
    socket.on("player:disconnected", onPlayerDisconnected);
    socket.on("player:reconnected", onPlayerReconnected);

    // Request fresh state on mount (handles page refresh)
    socket.emit("room:requestState");

    // Sync theme
    if (view?.theme) {
      document.body.dataset.theme = view.theme;
    }

    return () => {
      socket.off("game:event", onGameEvent);
      socket.off("error", onError);
      socket.off("player:disconnected", onPlayerDisconnected);
      socket.off("player:reconnected", onPlayerReconnected);
    };
  }, [roomId, navigate]);

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
        if (next <= 0) {
          // Countdown expired — remove overlay
          return null;
        }
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

    // Check if this is a wild card that needs color choice
    const card = view.myHand.find((c) => c.id === cardId);
    if (card && (card.type === "WILD" || card.type === "WILD_DRAW_FOUR") && card.color === null && !chosenColor) {
      // Intercept: show wild color picker first
      setPendingWildCardId(cardId);
      setAwaitingWildColor(true);
      return;
    }

    socket.emit("game:playCard", { roomId, cardId, chosenColor });
  }

  function handleWildColorChosen(color: CardColor) {
    if (!pendingWildCardId) return;
    socket.emit("game:playCard", {
      roomId,
      cardId: pendingWildCardId,
      chosenColor: color,
    });
    setPendingWildCardId(null);
    setAwaitingWildColor(false);
  }

  function handleDraw() {
    if (!roomId) return;
    socket.emit("game:drawCard", { roomId });
  }

  function handlePassTurn() {
    if (!roomId) return;
    socket.emit("game:passTurn", { roomId });
  }

  // ----- Reconnect handlers -----
  function handleRetry() {
    // Reconnect the socket
    socket.connect();
    // Request game state again
    if (roomId) {
      socket.emit("room:requestState");
    }
  }

  function handlePlayWithout() {
    if (!disconnectedPlayer || !roomId) return;
    socket.emit("game:playWithout", { roomId, playerId: disconnectedPlayer.playerId });
    setDisconnectedPlayer(null);
  }

  // ----- Handle illegal play toast from Hand -----
  const handleIllegalPlay = useCallback(() => {
    // The Hand component already fires its own toast
  }, []);

  // ----- Animation: table entrance -----
  const tableRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!tableRef.current) return;
      gsap.from(tableRef.current.children, {
        y: 30,
        opacity: 0,
        duration: 0.4,
        stagger: 0.06,
        ease: "power2.out",
      });
    },
    { scope: tableRef, dependencies: [!!view] },
  );

  // ----- Loading/redirect states -----

  // Redirect based on screen state
  useEffect(() => {
    if (state.screen === "roundOver") {
      // Navigate to results (Phase 6 will build this page)
      const data = state as { screen: "roundOver"; winnerId: string; scores: Record<string, number> };
      setTimeout(() => {
        navigate(`/table/${roomId}/results`, { state: { winnerId: data.winnerId, scores: data.scores } });
      }, 2000);
    } else if (state.screen === "waiting" || state.screen === "lobby") {
      if (roomId) {
        navigate(`/table/${roomId}/waiting`);
      }
    }
  }, [state.screen, roomId, navigate]);

  if (!view) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--ink-dim)] text-[14px]">Loading game…</div>
      </div>
    );
  }

  const isMyTurn = view.currentPlayerIndex === view.players.findIndex((p) => p.id === myPlayerId);
  const topCard = view.topCard;
  const canDraw = isMyTurn;

  return (
    <div
      ref={tableRef}
      className="min-h-screen flex flex-col items-center justify-between p-4 pb-8 relative overflow-hidden"
      style={{ background: "var(--bg)" }}
    >
      {/* Background glow */}
      <div
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "var(--bg-glow-1)" }}
      />

      {/* Opponents row */}
      <div className="relative z-10 w-full max-w-[800px]">
        <OpponentRow
          players={view.players}
          currentPlayerIndex={view.currentPlayerIndex}
          myPlayerId={myPlayerId}
        />
      </div>

      {/* Center area: discard + draw piles */}
      <div className="relative z-10 flex items-center gap-12">
        <DiscardPile topCard={topCard} activeColor={view.activeColor} />
        <DrawPile
          drawPileCount={view.drawPileCount}
          onDraw={handleDraw}
          canDraw={canDraw}
        />
      </div>

      {/* Pass button (visible on player's turn when they drew) + game info */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {isMyTurn && (
          <button
            onClick={handlePassTurn}
            className="px-6 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer bg-[var(--panel-2)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--line)] transition-colors duration-200"
          >
            Pass turn
          </button>
        )}

        {/* Turn indicator */}
        <div className="text-[12px] font-semibold text-[var(--ink-dim)]">
          {isMyTurn
            ? "Your turn"
            : `Waiting for ${view.players[view.currentPlayerIndex]?.name ?? "opponent"}…`}
        </div>

        {/* Direction indicator */}
        <div className="text-[11px] text-[var(--ink-dim)]">
          {view.direction === 1 ? "\u2192 Clockwise" : "\u2190 Counter-clockwise"}
        </div>
      </div>

      {/* Player's hand */}
      <div className="relative z-10 w-full max-w-[700px]">
        <Hand
          cards={view.myHand}
          onPlayCard={handlePlayCard}
          activeColor={view.activeColor}
          topCard={topCard}
          isMyTurn={isMyTurn}
          onIllegalPlay={handleIllegalPlay}
          onToast={(msg) => {
            const id = `toast-${++toastCounter.current}`;
            setToasts((prev) => [...prev, { id, ...msg }]);
          }}
        />
      </div>

      {/* Wild color picker */}
      {pendingWildCardId && (
        <WildColorPicker onChooseColor={handleWildColorChosen} />
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
