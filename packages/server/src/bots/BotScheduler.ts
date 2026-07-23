import { chooseBotMove } from "@wildcard/shared";
import type { Room } from "../rooms/Room.js";
import { logger } from "../utils/logger.js";

/**
 * Schedules a bot's turn after a randomized 600–1200ms delay.
 * Calls chooseBotMove() then executes the move via the Room.
 *
 * The BotScheduler subscribes to each Room's onBotTurn callback
 * so it knows when a bot's turn begins.
 */
export class BotScheduler {
  private activeTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Register a room for bot scheduling. */
  attach(room: Room): void {
    room.onBotTurn = () => this.schedule(room);

    // If the room is already in progress and it's a bot's turn, schedule immediately
    if (room.status === "IN_PROGRESS") {
      const state = room.getEngineState();
      if (state) {
        const currentPlayer = state.players[state.currentPlayerIndex];
        if (currentPlayer?.isBot) {
          this.schedule(room);
        }
      }
    }
  }

  /** Detach a room. */
  detach(roomId: string): void {
    this.cancel(roomId);
  }

  private schedule(room: Room): void {
    const roomId = room.roomId;
    this.cancel(roomId);

    const delay = 600 + Math.floor(Math.random() * 600); // 600–1200ms

    const timer = setTimeout(() => {
      this.activeTimers.delete(roomId);
      this.executeBotMove(room);
    }, delay);

    this.activeTimers.set(roomId, timer);
  }

  cancel(roomId: string): void {
    const existing = this.activeTimers.get(roomId);
    if (existing) {
      clearTimeout(existing);
      this.activeTimers.delete(roomId);
    }
  }

  cancelAll(): void {
    for (const [, timer] of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
  }

  private executeBotMove(room: Room): void {
    if (room.status !== "IN_PROGRESS") return;

    const state = room.getEngineState();
    if (!state) return;

    const playerId = room.currentPlayerId;
    if (!playerId) return;

    try {
      const botMove = chooseBotMove(state, playerId);

      if (botMove.type === "PLAY_CARD" && botMove.cardId) {
        room.playCard(playerId, botMove.cardId, botMove.chosenColor);
        logger.info(
          `Bot ${playerId} played ${botMove.cardId} in room ${room.roomId}`,
        );
      } else {
        // Draw card — bot has no playable card
        room.drawCard(playerId);

        // After drawing, check if the drawn card is playable
        const updatedState = room.getEngineState();
        if (updatedState) {
          const newMove = chooseBotMove(updatedState, playerId);
          if (newMove.type === "PLAY_CARD" && newMove.cardId) {
            room.playCard(playerId, newMove.cardId, newMove.chosenColor);
          } else {
            room.passTurn(playerId);
          }
        }
        logger.info(`Bot ${playerId} drew in room ${room.roomId}`);
      }
    } catch (err) {
      logger.error(
        `Bot move failed in room ${room.roomId}:`,
        (err as Error).message,
      );
    }
  }
}
