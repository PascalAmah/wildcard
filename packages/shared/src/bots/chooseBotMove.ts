import type { Card, CardColor, GameState } from "../types.js";
import { canPlay } from "../engine/canPlay.js";

export interface BotMove {
  type: "PLAY_CARD" | "DRAW_CARD";
  cardId?: string;
  chosenColor?: CardColor;
}

/**
 * v1 bot heuristic for choosing a move.
 *
 * Strategy (simple, effective):
 *  1. Find all playable cards in hand.
 *  2. If none, draw.
 *  3. Prefer a matching-color number card over an action card.
 *  4. Save wilds for last unless they're the only playable card.
 *  5. When playing a wild, choose the color the bot holds most of.
 */
export function chooseBotMove(state: GameState, playerId: string): BotMove {
  const hand = state.hands[playerId];
  const topCard = state.discardPile[state.discardPile.length - 1];

  // Find all playable cards
  const playable = hand.filter((card) => canPlay(card, topCard, state.activeColor));

  if (playable.length === 0) {
    return { type: "DRAW_CARD" };
  }

  // Separate wilds from non-wilds
  const nonWilds = playable.filter((c) => c.type !== "WILD" && c.type !== "WILD_DRAW_FOUR");
  const wilds = playable.filter((c) => c.type === "WILD" || c.type === "WILD_DRAW_FOUR");

  // Prefer non-wild cards: sort by number then action
  if (nonWilds.length > 0) {
    const chosen = pickBestNonWild(nonWilds);
    return {
      type: "PLAY_CARD",
      cardId: chosen.id,
    };
  }

  // Only wilds left — pick one and choose the color we have most of
  const chosen = wilds[Math.floor(Math.random() * wilds.length)];
  const chosenColor = pickMostHeldColor(state.hands[playerId]);

  return {
    type: "PLAY_CARD",
    cardId: chosen.id,
    chosenColor,
  };
}

/**
 * Pick the best non-wild card: prefer number cards, then pick the highest value.
 * If no number cards, pick any action card.
 */
function pickBestNonWild(cards: Card[]): Card {
  const numbers = cards.filter((c) => c.type === "NUMBER");
  if (numbers.length > 0) {
    // Play the highest number to shed points
    numbers.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return numbers[0];
  }

  // Prefer Draw Two (best tempo), then Skip, then Reverse
  const priority: Record<string, number> = {
    DRAW_TWO: 0,
    SKIP: 1,
    REVERSE: 2,
  };
  const sorted = [...cards].sort((a, b) => {
    const pa = priority[a.type] ?? 99;
    const pb = priority[b.type] ?? 99;
    return pa - pb;
  });

  return sorted[0];
}

/**
 * Count colors in hand (ignoring wilds) and return the most frequent one.
 * Ties are broken randomly.
 */
function pickMostHeldColor(hand: Card[]): CardColor {
  const counts: Record<string, number> = { green: 0, red: 0, yellow: 0, blue: 0 };

  for (const card of hand) {
    if (card.color && counts[card.color] !== undefined) {
      counts[card.color]++;
    }
  }

  const maxCount = Math.max(...Object.values(counts));
  const candidates = (Object.keys(counts) as CardColor[]).filter(
    (color) => counts[color] === maxCount,
  );

  return candidates[Math.floor(Math.random() * candidates.length)];
}
