import type { Card, CardColor } from "../types.js";

/**
 * Pure function: is `card` a legal move against the current discard top?
 *
 * A card is legal if:
 *  - It's a Wild or Wild Draw Four (always legal)
 *  - Its color matches the active color
 *  - It's a NUMBER and the top card is also a NUMBER with the same value
 *  - It's an action card (SKIP, REVERSE, DRAW_TWO) and the top card has the same type
 */
export function canPlay(
  card: Card,
  topCard: Card,
  activeColor: CardColor,
): boolean {
  // Chaos cards are always legal
  if (card.type === "WILD" || card.type === "WILD_DRAW_FOUR") {
    return true;
  }

  // Color match
  if (card.color === activeColor) {
    return true;
  }

  // Number match
  if (
    card.type === "NUMBER" &&
    topCard.type === "NUMBER" &&
    card.value === topCard.value
  ) {
    return true;
  }

  // Type match for action cards (Skip on Skip, Reverse on Reverse, Draw Two on Draw Two)
  if (
    card.type !== "NUMBER" &&
    topCard.type !== "NUMBER" &&
    topCard.type !== "WILD" &&
    topCard.type !== "WILD_DRAW_FOUR" &&
    card.type === topCard.type
  ) {
    return true;
  }

  return false;
}
