import { GameEngine } from "@wildcard/shared";
import type {
  CardColor,
  ClientView,
  GameState,
  Player,
  RoundOverResult,
} from "@wildcard/shared";
import type { RoomData, RoomPlayerData, RoomStore } from "../store/roomStore.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export type BroadcastFn = (
  event: string,
  data: unknown,
  playerIds?: string[],
) => void;

export class Room {
  readonly roomId: string;
  private store: RoomStore;
  private broadcast: BroadcastFn;

  private data: RoomData;
  private engine: GameEngine | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;

  // Called by BotScheduler after a short delay when it's a bot's turn
  onBotTurn?: () => void;

  // Called when the last player leaves (room becomes empty)
  onEmpty?: () => void;

  // Server-side 60s grace period timers — one per disconnected player
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(data: RoomData, store: RoomStore, broadcast: BroadcastFn) {
    this.roomId = data.roomId;
    this.store = store;
    this.broadcast = broadcast;
    this.data = data;
  }

  get status(): RoomData["status"] {
    return this.data.status;
  }

  get players(): RoomPlayerData[] {
    return this.data.players;
  }

  get hostId(): string {
    return this.data.hostId;
  }

  get maxPlayers(): number {
    return this.data.maxPlayers;
  }

  get theme(): RoomData["theme"] {
    return this.data.theme;
  }

  /** Update the arena theme (host only, lobby only). */
  setTheme(theme: RoomData["theme"]): void {
    if (this.data.status !== "WAITING") return;
    this.data.theme = theme;
    this.persist();
  }

  get currentPlayerId(): string | null {
    if (!this.engine) return null;
    const state = this.engine.getState();
    return state.players[state.currentPlayerIndex]?.id ?? null;
  }

  /** Expose the raw GameState for BotScheduler (needs full state for chooseBotMove). */
  getEngineState(): GameState | null {
    return this.engine?.getState() ?? null;
  }

  /** Check if the room can accept more human players. */
  canJoin(): boolean {
    return (
      this.data.status === "WAITING" &&
      this.data.players.length < this.data.maxPlayers
    );
  }

  /** Add a human player to the waiting room. */
  addPlayer(id: string, name: string): void {
    if (!this.canJoin()) {
      throw new Error("ROOM_FULL");
    }
    if (this.data.status !== "WAITING") {
      throw new Error("ROOM_IN_PROGRESS");
    }
    this.data.players.push({ id, name, isBot: false, isReady: false });
    this.persist();
  }

  /** Remove a player (or bot) by id. */
  removePlayer(playerId: string): void {
    this.clearDisconnectTimer(playerId);
    this.data.players = this.data.players.filter((p) => p.id !== playerId);
    // Reassign host if the host left
    if (this.data.hostId === playerId && this.data.players.length > 0) {
      this.data.hostId = this.data.players[0].id;
    }
    this.persist();

    if (this.data.players.length === 0) {
      this.onEmpty?.();
    }
  }

  /**
   * Start a 60s grace period timer for a disconnected player.
   * If they don't reconnect before expiry, auto-remove them.
   */
  startDisconnectTimer(playerId: string): void {
    this.clearDisconnectTimer(playerId);
    const timer = setTimeout(() => {
      try {
        this.disconnectTimers.delete(playerId);
        const player = this.data.players.find((p) => p.id === playerId);
        if (!player) return;

        logger.info(
          `Grace period expired for ${player.name} in room ${this.roomId} — removing seat`,
        );

        if (this.data.status === "IN_PROGRESS") {
          this.playWithout(playerId);
        } else if (this.data.status === "WAITING" || this.data.status === "ROUND_OVER") {
          this.removePlayer(playerId);

          // Notify remaining clients that the player has been removed
          this.broadcast("player:reconnected", {
            playerId,
            playerName: player.name,
            removed: true,
          });
        }
      } catch (err) {
        logger.error(
          `Disconnect timer error in room ${this.roomId}:`,
          (err as Error).message,
        );
      }
    }, 30_000);
    this.disconnectTimers.set(playerId, timer);
  }

  /** Cancel a disconnect grace period timer (called on reconnect). */
  clearDisconnectTimer(playerId: string): void {
    const timer = this.disconnectTimers.get(playerId);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(playerId);
    }
  }

  /** Toggle a player's ready state (lobby only). */
  setReady(playerId: string, ready: boolean): void {
    const player = this.data.players.find((p) => p.id === playerId);
    if (player) {
      player.isReady = ready;
      this.persist();
    }
  }

  /** Add a bot to the room (host only, lobby only). */
  addBot(id: string, name: string): void {
    if (this.data.status !== "WAITING") {
      throw new Error("ROOM_IN_PROGRESS");
    }
    if (this.data.players.length >= this.data.maxPlayers) {
      throw new Error("ROOM_FULL");
    }
    this.data.players.push({ id, name, isBot: true, isReady: true });
    this.persist();
  }

  /** Remove a bot (host only, lobby only). */
  removeBot(botId: string): void {
    const bot = this.data.players.find((p) => p.id === botId && p.isBot);
    if (!bot) throw new Error("Bot not found");
    this.removePlayer(botId);
  }

  /**
   * Start the game: transition from WAITING to IN_PROGRESS,
   * create the GameEngine, start the turn timer if first player is a bot.
   */
  startGame(): void {
    if (this.data.status !== "WAITING") {
      throw new Error("Game already started");
    }
    if (this.data.players.length < 2) {
      throw new Error("Need at least 2 players");
    }

    const players: Player[] = this.data.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
    }));

    this.engine = new GameEngine(
      this.roomId,
      players,
      this.data.theme,
      this.data.maxPlayers,
    );

    this.data.status = "IN_PROGRESS";
    this.persist();

    // Broadcast initial game state to all players
    this.broadcastGameState();

    // Start turn timer or schedule bot
    this.scheduleTurn();
  }

  // ---- Game actions ----

  playCard(
    playerId: string,
    cardId: string,
    chosenColor?: CardColor,
  ): RoundOverResult | null {
    if (!this.engine) throw new Error("Game not started");
    if (this.data.status !== "IN_PROGRESS") {
      throw new Error("Game not in progress");
    }

    let result: RoundOverResult | null;
    try {
      result = this.engine.playCard(playerId, cardId, chosenColor);
    } catch (err) {
      const msg = (err as Error).message;
      // Silently ignore duplicate emits — if the card is already on top of
      // the discard pile, the first emit already processed it successfully.
      if (msg === "Card not found in hand") {
        const state = this.engine.getState();
        const topCard = state.discardPile[state.discardPile.length - 1];
        if (topCard && topCard.id === cardId) {
          return null;
        }
      }
      throw err;
    }

    this.persist();

    if (result) {
      // Round is over
      this.data.status = "ROUND_OVER";
      this.data.gameState = this.engine.getState();
      this.persist();
      this.clearTurnTimer();
      this.broadcast("game:roundOver", result);
      // Don't broadcast game:state after round over — the round-over
      // event is sufficient and prevents the client from flipping back
      // to the "playing" screen.
      return result;
    }

    this.broadcastGameState();
    this.scheduleTurn();

    return result;
  }

  drawCard(playerId: string): void {
    if (!this.engine) throw new Error("Game not started");
    if (this.data.status !== "IN_PROGRESS") {
      throw new Error("Game not in progress");
    }

    this.engine.drawCard(playerId);
    this.persist();
    this.broadcastGameState();

    // Auto-pass: after drawing, the turn always ends so the next player
    // can go. This keeps the game fast and fair — no stalling after a draw.
    this.engine.passTurn(playerId);
    this.persist();
    this.broadcastGameState();
    this.scheduleTurn();
  }

  passTurn(playerId: string): void {
    if (!this.engine) throw new Error("Game not started");
    if (this.data.status !== "IN_PROGRESS") {
      throw new Error("Game not in progress");
    }

    this.engine.passTurn(playerId);
    this.persist();
    this.broadcastGameState();
    this.scheduleTurn();
  }

  // ---- Rematch ----

  /**
   * Start a fresh round in the same room with the same players.
   * Called when the host requests a rematch.
   */
  rematch(): void {
    if (this.data.status !== "ROUND_OVER") {
      throw new Error("Round is not over");
    }

    const players: Player[] = this.data.players.map((p) => ({
      id: p.id,
      name: p.name,
      isBot: p.isBot,
    }));

    this.engine = new GameEngine(
      this.roomId,
      players,
      this.data.theme,
      this.data.maxPlayers,
    );

    this.data.status = "IN_PROGRESS";
    this.persist();

    // Broadcast initial game state to all players
    this.broadcastGameState();

    // Notify the room about the rematch
    this.broadcast("game:rematch", {});

    // Start turn timer or schedule bot
    this.scheduleTurn();
  }

  // ---- Play without disconnected player ----

  /**
   * Remove a player from the game mid-round (disconnect timeout or host vote).
   * Removes them from the engine and the room's player list.
   * If only one player remains, ends the round with them as winner.
   */
  playWithout(playerId: string): void {
    if (!this.engine) throw new Error("Game not started");
    if (this.data.status !== "IN_PROGRESS") {
      throw new Error("Game not in progress");
    }

    // Capture the player's name before removing them
    const leavingPlayer = this.data.players.find((p) => p.id === playerId);

    // Remove from engine — returns RoundOverResult if only one player remains
    const result = this.engine.removePlayer(playerId);

    // Remove from the room's player list (reassigns host if needed)
    this.removePlayer(playerId);
    this.clearTurnTimer();
    this.persist();

    if (result) {
      // Only one player remains — round is over
      this.data.status = "ROUND_OVER";
      this.data.gameState = this.engine.getState();
      this.persist();
      this.broadcast("game:roundOver", result);
    } else if (this.engine.getState().players.length <= 1) {
      // Engine didn't detect round-over (edge case), end it manually
      const winnerId = this.engine.getState().players[0]?.id;
      if (winnerId) {
        this.data.status = "ROUND_OVER";
        this.data.gameState = this.engine.getState();
        this.persist();
        this.broadcast("game:roundOver", {
          winnerId,
          scores: { [winnerId]: 0 },
          handCounts: { [winnerId]: 0 },
        });
      }
    } else {
      // Game continues with remaining players
      this.broadcastGameState();
      this.scheduleTurn();
    }

    // Notify remaining players
    this.broadcast("player:reconnected", {
      playerId,
      playerName: playerId,
      removed: true,
    });

    // Show a toast notification for remaining players
    const name = leavingPlayer?.name ?? playerId;
    this.broadcast("game:event", {
      type: "PLAYER_LEFT",
      actorId: playerId,
      message: `${name} left the game`,
    });
  }

  // ---- Turn timer ----

  private scheduleTurn(): void {
    this.clearTurnTimer();
    if (this.data.status !== "IN_PROGRESS" || !this.engine) return;

    const state = this.engine.getState();
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer) return;

    if (currentPlayer.isBot) {
      // Let BotScheduler handle this
      this.onBotTurn?.();
      return;
    }

    this.turnTimer = setTimeout(() => {
      try {
        if (!this.engine) return;
        const s = this.engine.getState();
        const cp = s.players[s.currentPlayerIndex];
        if (!cp) return;

        logger.info(`Turn timeout for player ${cp.name} in room ${this.roomId}`);
        this.engine.onTurnTimeout(cp.id);
        this.persist();
        this.broadcast("game:event", {
          type: "TIMEOUT",
          actorId: cp.id,
          message: `${cp.name} ran out of time — auto-draw`,
        });
        this.broadcastGameState();
        this.scheduleTurn();
      } catch (err) {
        logger.error(
          `Turn timeout error in room ${this.roomId}:`,
          (err as Error).message,
        );
        // Attempt recovery: advance turn and keep the game alive
        try {
          if (this.engine) {
            this.engine.onTurnTimeout(
              this.engine.getState().players[this.engine.getState().currentPlayerIndex]?.id ?? "",
            );
            this.persist();
            this.broadcastGameState();
            this.scheduleTurn();
          }
        } catch {
          logger.error(`Failed to recover from timeout error in room ${this.roomId}`);
        }
      }
    }, config.turnTimeoutMs);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }

  // ---- Persistence & broadcast ----

  /** Serialize current state and persist to Redis. */
  private persist(): void {
    this.data.gameState = this.engine?.getState();
    this.store.setRoom(this.data).catch((err) => {
      logger.error(`Failed to persist room ${this.roomId}:`, err);
    });
  }

  /** Broadcast per-player ClientView to all connected sockets. */
  private broadcastGameState(): void {
    if (!this.engine) return;

    for (const player of this.data.players) {
      this.sendGameStateToPlayer(player.id);
    }
  }

  /** Send the ClientView to a single player (used by rejoin). */
  sendGameStateToPlayer(playerId: string): void {
    if (!this.engine) return;
    const view = this.engine.toClientView(playerId);
    this.broadcast("game:state", view, [playerId]);
  }

  /** Build a ClientView without broadcasting (used by rejoin to emit directly). */
  getClientView(playerId: string): ClientView | null {
    if (!this.engine) return null;
    return this.engine.toClientView(playerId);
  }

  /** Rebuild this Room from stored data (e.g. on server restart). */
  static fromData(data: RoomData, store: RoomStore, broadcast: BroadcastFn): Room {
    const room = new Room(data, store, broadcast);

    if (data.gameState && data.status !== "WAITING") {
      const players: Player[] = data.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
      }));

      room.engine = new GameEngine(
        data.roomId,
        players,
        data.theme,
        data.maxPlayers,
      );

      // Properly restore the full engine state from persisted data.
      // Uses a JSON round-trip for a deep copy — same format Redis stored it in.
      room.engine.restoreState(data.gameState);
    }

    return room;
  }
}
