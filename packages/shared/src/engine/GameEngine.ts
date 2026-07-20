import type { Card, CardColor, GameState, ClientView, Player, RoomStatus } from "../types.js";
import { setupDeck, drawFromPile } from "../deck.js";
import { canPlay } from "./canPlay.js";
import { applyEffect, cardScore } from "./applyEffect.js";
import { getNextPlayerIndex } from "./turnOrder.js";
import { EffectQueue } from "./effectQueue.js";

export type GameAction =
  | { type: "PLAY_CARD"; cardId: string; chosenColor?: CardColor }
  | { type: "DRAW_CARD" }
  | { type: "PASS_TURN" };

export interface RoundOverResult {
  winnerId: string;
  scores: Record<string, number>;
}

export class GameEngine {
  private state: GameState;

  constructor(
    roomId: string,
    players: Player[],
    theme: "midnight" | "neon" | "sunset" | "forest" = "midnight",
    maxPlayers: number = 4,
  ) {
    const { hands, drawPile, discardPile } = setupDeck(players.length);

    this.state = {
      roomId,
      status: "IN_PROGRESS",
      players: players.map((p) => ({ ...p })),
      hands,
      drawPile,
      discardPile,
      activeColor: discardPile[0].color!,
      currentPlayerIndex: 0,
      direction: 1,
      maxPlayers,
      theme,
      winnerId: null,
    };
  }

  getState(): GameState {
    return this.state;
  }

  /**
   * Attempt to play a card from a player's hand.
   * Returns null on success, or an error message string on failure.
   */
  playCard(
    playerId: string,
    cardId: string,
    chosenColor?: CardColor,
  ): RoundOverResult | null {
    // Validate it's this player's turn
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      throw new Error("NOT_YOUR_TURN");
    }

    const hand = this.state.hands[playerId];
    if (!hand) {
      throw new Error("Player not found");
    }

    const cardIndex = hand.findIndex((c) => c.id === cardId);
    if (cardIndex === -1) {
      throw new Error("Card not found in hand");
    }

    const card = hand[cardIndex];
    const topCard = this.state.discardPile[this.state.discardPile.length - 1];

    // Validate the move
    if (!canPlay(card, topCard, this.state.activeColor)) {
      throw new Error("ILLEGAL_MOVE");
    }

    // Remove the card from the player's hand
    hand.splice(cardIndex, 1);

    // Add to discard pile
    this.state.discardPile.push(card);

    // Resolve effects
    const effectQueue = new EffectQueue();
    const newActiveColor = applyEffect(
      card,
      this.state.currentPlayerIndex,
      this.state.direction,
      this.state.players.length,
      effectQueue,
      chosenColor,
    );
    this.state.activeColor = newActiveColor;

    // Process the effect queue
    const prevIndex = this.state.currentPlayerIndex;
    this.processEffectQueue(effectQueue);

    // If the effect queue didn't advance the turn (no skip/draw+skip), advance normally
    if (this.state.currentPlayerIndex === prevIndex) {
      this.state.currentPlayerIndex = getNextPlayerIndex(
        this.state.currentPlayerIndex,
        this.state.direction,
        this.state.players.length,
      );
    }

    // Check for round-over
    if (hand.length === 0) {
      return this.checkRoundOver(playerId);
    }

    return null;
  }

  /**
   * Draw one card from the draw pile.
   *
   * The turn does NOT advance — the caller must follow up with either
   * playCard() (if they want to play the drawn card) or passTurn()
   * (if the drawn card is not playable or they choose not to play it).
   *
   * Returns the drawn card so the caller can check legality
   * (e.g. via canPlay()) before deciding to play it.
   */
  drawCard(playerId: string): Card {
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      throw new Error("NOT_YOUR_TURN");
    }

    const { card, drawPile: newDrawPile, discardPile: newDiscardPile } = drawFromPile(
      this.state.drawPile,
      this.state.discardPile,
    );
    this.state.drawPile = newDrawPile;
    this.state.discardPile = newDiscardPile;

    // Add drawn card to player's hand
    this.state.hands[playerId].push(card);

    return card;
  }

  /**
   * End the current player's turn without playing a card.
   * Only valid after a drawCard() call when the drawn card is not
   * playable or the player chooses not to play it.
   */
  passTurn(playerId: string): void {
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) {
      throw new Error("NOT_YOUR_TURN");
    }

    this.state.currentPlayerIndex = getNextPlayerIndex(
      this.state.currentPlayerIndex,
      this.state.direction,
      this.state.players.length,
    );
  }

  /**
   * Handle a turn timeout: auto-draw one card and always end the turn.
   * Never auto-plays, even if the drawn card is legal.
   *
   * Per the locked decision in the build plan:
   * "On timeout, the server auto-draws one card and always ends the turn."
   */
  onTurnTimeout(playerId: string): void {
    // Silently no-op if it's not this player's turn (e.g. timeout fired late)
    const currentPlayer = this.state.players[this.state.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return;

    // Auto-draw one card
    const { card, drawPile: newDrawPile, discardPile: newDiscardPile } = drawFromPile(
      this.state.drawPile,
      this.state.discardPile,
    );
    this.state.drawPile = newDrawPile;
    this.state.discardPile = newDiscardPile;

    this.state.hands[playerId].push(card);

    // Always advance turn
    this.state.currentPlayerIndex = getNextPlayerIndex(
      this.state.currentPlayerIndex,
      this.state.direction,
      this.state.players.length,
    );
  }

  /**
   * Process the effect queue, mutating game state for each step.
   */
  private processEffectQueue(queue: EffectQueue): void {
    while (queue.length > 0) {
      const step = queue.dequeue();
      if (!step) break;

      switch (step.type) {
        case "draw": {
          const targetHand = this.state.hands[this.state.players[step.targetPlayerIndex].id];
          for (let i = 0; i < step.count; i++) {
            const { card, drawPile: newDrawPile, discardPile: newDiscardPile } = drawFromPile(
              this.state.drawPile,
              this.state.discardPile,
            );
            this.state.drawPile = newDrawPile;
            this.state.discardPile = newDiscardPile;
            targetHand.push(card);
          }
          break;
        }
        case "skipTurn": {
          // Advance to the skipped index
          this.state.currentPlayerIndex = step.targetPlayerIndex;
          break;
        }
        case "reverseDirection": {
          this.state.direction = this.state.direction === 1 ? -1 : 1;
          break;
        }
        case "setActiveColor": {
          this.state.activeColor = step.color as CardColor;
          break;
        }
      }
    }
  }

  /**
   * Detect round-over, compute scores, and return the result.
   * The winner scores points equal to the total value of every card
   * left in every other player's hand.
   */
  private checkRoundOver(winnerId: string): RoundOverResult {
    this.state.status = "ROUND_OVER";
    this.state.winnerId = winnerId;

    const scores: Record<string, number> = {};
    let totalScore = 0;

    for (const player of this.state.players) {
      if (player.id === winnerId) {
        scores[player.id] = 0; // Winner scores 0 this round; they get the total
      } else {
        const hand = this.state.hands[player.id];
        const handScore = hand.reduce((sum, card) => sum + cardScore(card), 0);
        scores[player.id] = handScore;
        totalScore += handScore;
      }
    }

    // Winner scores the sum of all other players' hand values
    scores[winnerId] = totalScore;

    return { winnerId, scores };
  }

  /**
   * Create a client view for a specific player.
   * Redacts all hands except the requesting player's to just counts.
   */
  toClientView(playerId: string): ClientView {
    return {
      roomId: this.state.roomId,
      status: this.state.status,
      players: this.state.players.map((p) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        handCount: this.state.hands[p.id].length,
      })),
      myHand: this.state.hands[playerId] ?? [],
      topCard: this.state.discardPile[this.state.discardPile.length - 1],
      activeColor: this.state.activeColor,
      currentPlayerIndex: this.state.currentPlayerIndex,
      direction: this.state.direction,
      drawPileCount: this.state.drawPile.length,
      maxPlayers: this.state.maxPlayers,
      theme: this.state.theme,
      winnerId: this.state.winnerId,
    };
  }
}
