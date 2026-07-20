import type { Card, CardColor, GameState } from "../types.js";
import { EffectQueue, type EffectStep } from "./effectQueue.js";
import { getNextPlayerIndex, getSkippedPlayerIndex } from "./turnOrder.js";

/**
 * Resolve the effects of a played card and enqueue steps into the effect queue.
 *
 * This function does NOT mutate GameState directly — it pushes steps into
 * the queue and returns the chosen color (for wilds) so the caller
 * (GameEngine) can resolve everything together.
 *
 * @returns The activeColor to set (may be the same as before, or a newly
 *          declared color for wilds).
 */
export function applyEffect(
  card: Card,
  currentPlayerIndex: number,
  direction: 1 | -1,
  playerCount: number,
  effectQueue: EffectQueue,
  chosenColor?: CardColor,
): CardColor {
  switch (card.type) {
    case "SKIP": {
      // The next player's turn is skipped entirely.
      // getSkippedPlayerIndex advances by two positions (current + 2*direction),
      // so the immediate next player loses their turn.
      const skipIndex = getSkippedPlayerIndex(
        currentPlayerIndex,
        direction,
        playerCount,
      );
      effectQueue.enqueue({ type: "skipTurn", targetPlayerIndex: skipIndex });
      return card.color!;
    }

    case "REVERSE": {
      effectQueue.enqueue({ type: "reverseDirection" });
      // In a 2-player game, Reverse acts as a Skip
      if (playerCount === 2) {
        const skipIndex = getSkippedPlayerIndex(
          currentPlayerIndex,
          direction,
          playerCount,
        );
        effectQueue.enqueue({ type: "skipTurn", targetPlayerIndex: skipIndex });
      }
      return card.color!;
    }

    case "DRAW_TWO": {
      const nextIndex = getNextPlayerIndex(
        currentPlayerIndex,
        direction,
        playerCount,
      );
      const skipIndex = getSkippedPlayerIndex(
        currentPlayerIndex,
        direction,
        playerCount,
      );
      effectQueue.enqueue({ type: "draw", count: 2, targetPlayerIndex: nextIndex });
      effectQueue.enqueue({ type: "skipTurn", targetPlayerIndex: skipIndex });
      return card.color!;
    }

    case "WILD": {
      if (!chosenColor) {
        throw new Error("chosenColor is required when playing a WILD");
      }
      return chosenColor;
    }

    case "WILD_DRAW_FOUR": {
      if (!chosenColor) {
        throw new Error("chosenColor is required when playing a WILD_DRAW_FOUR");
      }
      const nextIndex = getNextPlayerIndex(
        currentPlayerIndex,
        direction,
        playerCount,
      );
      const skipIndex = getSkippedPlayerIndex(
        currentPlayerIndex,
        direction,
        playerCount,
      );
      effectQueue.enqueue({ type: "draw", count: 4, targetPlayerIndex: nextIndex });
      effectQueue.enqueue({ type: "skipTurn", targetPlayerIndex: skipIndex });
      return chosenColor;
    }

    case "NUMBER": {
      // Number cards have no effects
      return card.color!;
    }
  }
}

/**
 * Compute the score value of a card for round-over scoring.
 */
export function cardScore(card: Card): number {
  if (card.type === "NUMBER") {
    return card.value ?? 0;
  }
  // Skip, Reverse, Draw Two
  if (card.type === "SKIP" || card.type === "REVERSE" || card.type === "DRAW_TWO") {
    return 20;
  }
  // Wild, Wild Draw Four
  return 50;
}
