import type { Card, CardColor, CardType } from "./types.js";

const COLORS: CardColor[] = ["green", "red", "yellow", "blue"];

let _nextId = 0;
function resetIdCounter(): void {
  _nextId = 0;
}

function makeCard(type: CardType, color: CardColor | null, value: number | null): Card {
  return {
    id: String(_nextId++),
    type,
    color,
    value,
  };
}

/**
 * Build a standard 108-card Wildcard deck.
 *
 * Per color: one 0, two each of 1–9, two each of Skip/Reverse/Draw Two = 25 per color = 100.
 * Plus 4 Wilds + 4 Wild Draw Fours = 8 chaos cards = 108 total.
 */
export function buildDeck(): Card[] {
  resetIdCounter();
  const deck: Card[] = [];

  for (const color of COLORS) {
    // One 0 per color
    deck.push(makeCard("NUMBER", color, 0));

    // Two each of 1–9 per color
    for (let value = 1; value <= 9; value++) {
      deck.push(makeCard("NUMBER", color, value));
      deck.push(makeCard("NUMBER", color, value));
    }

    // Two each of Skip, Reverse, Draw Two per color
    const actionTypes: CardType[] = ["SKIP", "REVERSE", "DRAW_TWO"];
    for (const type of actionTypes) {
      deck.push(makeCard(type, color, null));
      deck.push(makeCard(type, color, null));
    }
  }

  // Four Wilds
  for (let i = 0; i < 4; i++) {
    deck.push(makeCard("WILD", null, null));
  }

  // Four Wild Draw Fours
  for (let i = 0; i < 4; i++) {
    deck.push(makeCard("WILD_DRAW_FOUR", null, null));
  }

  return deck; // 108 cards
}

/** Fisher-Yates shuffle — returns a new array. */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Draw the top card from the draw pile.
 * If the draw pile is empty, reshuffle the discard pile (except the top card)
 * into a fresh draw pile and continue.
 */
export function drawFromPile(
  drawPile: Card[],
  discardPile: Card[],
): { card: Card; drawPile: Card[]; discardPile: Card[] } {
  let newDrawPile = [...drawPile];
  let newDiscardPile = [...discardPile];

  if (newDrawPile.length === 0) {
    const top = newDiscardPile.pop()!;
    newDrawPile = shuffle(newDiscardPile);
    newDiscardPile = [top];
  }

  const card = newDrawPile.shift()!;
  return { card, drawPile: newDrawPile, discardPile: newDiscardPile };
}

/**
 * Set up the discard pile for a new game.
 * Deals 7 cards to each player, flips the first starter card.
 * If it's a Wild / Wild Draw Four, reshuffles it back in and flips again.
 */
export function setupDeck(
  playerCount: number,
): { hands: Record<string, Card[]>; drawPile: Card[]; discardPile: Card[] } {
  let deck = shuffle(buildDeck());

  // Deal 7 cards to each player
  const playerIds = Array.from({ length: playerCount }, (_, i) => String(i));
  const hands: Record<string, Card[]> = {};

  for (const pid of playerIds) {
    hands[pid] = deck.splice(0, 7);
  }

  // Flip the starter — reshuffle and retry if it's a chaos card
  let starter = deck.shift()!;
  while (starter.type === "WILD" || starter.type === "WILD_DRAW_FOUR") {
    deck.push(starter);
    deck = shuffle(deck);
    starter = deck.shift()!;
  }

  const discardPile = [starter];

  return { hands, drawPile: deck, discardPile };
}
