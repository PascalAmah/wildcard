import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { CardColor } from "@wildcard/shared";
import { socket } from "../lib/socketClient";
import { useGameState } from "../hooks/useGameState";
import type { GameView } from "../hooks/useGameState";
import { reducedMotionMQ } from "../lib/gsapConfig";
import DiscardPile from "../components/table/DiscardPile";
import type { DiscardPileHandle } from "../components/table/DiscardPile";
import DrawPile from "../components/table/DrawPile";
import Hand, { executeFlyToDiscard } from "../components/table/Hand";
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

  // ----- Local UI state -----
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pendingWildCardId, setPendingWildCardId] = useState<string | null>(null);
  const [disconnectedPlayer, setDisconnectedPlayer] = useState<{
    playerId: string;
    playerName: string;
    countdown: number;
  } | null>(null);

  const toastCounter = useRef(0);

  // ----- Socket event listeners -----
  useEffect(() => {
    if (!roomId) return;

    function onGameEvent(event: GameEvent) {
      const id = `toast-${++toastCounter.current}`;
      setToasts((prev) => [...prev, { id, message: event.message, type: "info" as const }]);
    }

    function onError(err: { code: string; message: string }) {
      const id = `toast-${++toastCounter.current}`;
      setToasts((prev) => [
        ...prev,
        { id, message: err.message || `Error: ${err.code}`, type: "error" as const },
      ]);
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

    socket.emit("game:playCard", { roomId, cardId, chosenColor });
  }

  function handleWildColorChosen(color: CardColor) {
    if (!pendingWildCardId || !roomId) return;

    const targetEl = discardPileRef.current?.cardEl ?? null;

    // Fly the card to discard pile, then emit
    executeFlyToDiscard(pendingWildCardId, targetEl, () => {
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

  function handlePassTurn() {
    if (!roomId) return;
    socket.emit("game:passTurn", { roomId });
  }

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
      reducedMotionMQ.add("(prefers-reduced-motion: no-preference)", (ctx) => {
        ctx.add(() => {
          return gsap
            .from(tableRef.current!.children, {
              y: 30,
              opacity: 0,
              duration: 0.4,
              stagger: 0.06,
              ease: "power2.out",
            })
            .kill;
        });
      });
    },
    { scope: tableRef, dependencies: [!!view] },
  );

  // ----- Screen-based redirects -----
  useEffect(() => {
    if (state.screen === "roundOver") {
      const data = state as { screen: "roundOver"; winnerId: string; scores: Record<string, number>; handCounts: Record<string, number> };
      setTimeout(() => {
        navigate(`/table/${roomId}/results`, {
          state: { winnerId: data.winnerId, scores: data.scores, handCounts: data.handCounts },
        });
      }, 2000);
    } else if (state.screen === "waiting" || state.screen === "lobby") {
      if (roomId) {
        navigate(`/table/${roomId}/waiting`);
      }
    }
  }, [state.screen, roomId, navigate]);

  // ----- Loading state -----
  if (!view) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--ink-dim)] text-[14px]">Loading game…</div>
      </div>
    );
  }

  const isMyTurn =
    view.currentPlayerIndex === view.players.findIndex((p) => p.id === myPlayerId);
  const topCard = view.topCard;
  const discardCardEl = discardPileRef.current?.cardEl ?? null;

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
        <DiscardPile ref={discardPileRef} topCard={topCard} activeColor={view.activeColor} />
        <DrawPile
          drawPileCount={view.drawPileCount}
          onDraw={handleDraw}
          canDraw={isMyTurn}
        />
      </div>

      {/* Pass button + turn info */}
      <div className="relative z-10 flex flex-col items-center gap-3">
        {isMyTurn && (
          <button
            onClick={handlePassTurn}
            className="px-6 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer bg-[var(--panel-2)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--line)] transition-colors duration-200"
          >
            Pass turn
          </button>
        )}

        <div className="text-[12px] font-semibold text-[var(--ink-dim)]">
          {isMyTurn
            ? "Your turn"
            : `Waiting for ${view.players[view.currentPlayerIndex]?.name ?? "opponent"}…`}
        </div>

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
          discardPileEl={discardCardEl}
          onIllegalPlay={() => {}}
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
