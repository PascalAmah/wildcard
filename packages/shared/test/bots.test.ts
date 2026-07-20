import { describe, it, expect } from "vitest";
import { chooseBotMove } from "../src/bots/chooseBotMove.js";
import { buildDeck, shuffle, setupDeck } from "../src/deck.js";
import type { Card, GameState, Player, CardColor } from "../src/types.js";

function makeState(overrides: Partial<GameState> = {}): GameState {
  const deck = shuffle(buildDeck());
  const players: Player[] = [
    { id: "0", name: "Bot 0", isBot: true },
    { id: "1", name: "Bot 1", isBot: true },
  ];

  return {
    roomId: "room1",
    status: "IN_PROGRESS",
    players,
    hands: {
      "0": deck.slice(0, 7),
      "1": deck.slice(7, 14),
    },
    drawPile: deck.slice(14),
    discardPile: [
      deck[14], // Some non-wild starter
    ],
    activeColor: deck[14].color!,
    currentPlayerIndex: 0,
    direction: 1,
    maxPlayers: 2,
    theme: "midnight",
    winnerId: null,
    ...overrides,
  };
}

describe("chooseBotMove", () => {
  it("returns DRAW_CARD when no cards are playable", () => {
    // Force a scenario where the bot has no legal plays
    const state = makeState({
      hands: {
        "0": [
          { id: "c1", type: "NUMBER", color: "blue", value: 9 },
        ],
        "1": [],
      },
      discardPile: [
        { id: "top", type: "NUMBER", color: "red", value: 5 },
      ],
      activeColor: "red",
    });

    const move = chooseBotMove(state, "0");
    expect(move.type).toBe("DRAW_CARD");
  });

  it("returns PLAY_CARD when a legal card exists", () => {
    const state = makeState({
      hands: {
        "0": [
          { id: "c1", type: "NUMBER", color: "red", value: 3 },
          { id: "c2", type: "NUMBER", color: "blue", value: 7 },
        ],
        "1": [],
      },
      discardPile: [
        { id: "top", type: "NUMBER", color: "red", value: 5 },
      ],
      activeColor: "red",
    });

    const move = chooseBotMove(state, "0");
    expect(move.type).toBe("PLAY_CARD");
    expect(move.cardId).toBeDefined();
  });

  it("prefers a non-wild card when both wild and non-wild are playable", () => {
    const state = makeState({
      hands: {
        "0": [
          { id: "c1", type: "NUMBER", color: "red", value: 3 },
          { id: "c2", type: "WILD", color: null, value: null },
        ],
        "1": [],
      },
      discardPile: [
        { id: "top", type: "NUMBER", color: "red", value: 5 },
      ],
      activeColor: "red",
    });

    const move = chooseBotMove(state, "0");
    expect(move.type).toBe("PLAY_CARD");
    expect(move.cardId).toBe("c1"); // Should pick the number card, not the wild
  });

  it("plays a wild with a chosen color when it's the only option", () => {
    const state = makeState({
      hands: {
        "0": [
          { id: "c1", type: "WILD", color: null, value: null },
        ],
        "1": [],
      },
      discardPile: [
        { id: "top", type: "NUMBER", color: "red", value: 5 },
      ],
      activeColor: "red",
    });

    const move = chooseBotMove(state, "0");
    expect(move.type).toBe("PLAY_CARD");
    expect(move.cardId).toBe("c1");
    expect(move.chosenColor).toBeDefined();
  });

  it("chooses a color the bot holds most of when playing a wild", () => {
    const state = makeState({
      hands: {
        "0": [
          { id: "w1", type: "WILD", color: null, value: null },
          { id: "b1", type: "NUMBER", color: "blue", value: 1 },
          { id: "b2", type: "NUMBER", color: "blue", value: 2 },
          { id: "r1", type: "NUMBER", color: "red", value: 3 },
        ],
        "1": [],
      },
      discardPile: [
        { id: "top", type: "NUMBER", color: "green", value: 5 },
      ],
      activeColor: "green",
    });

    // The only playable card is the wild since nothing matches green
    const move = chooseBotMove(state, "0");
    expect(move.type).toBe("PLAY_CARD");
    expect(move.chosenColor).toBe("blue"); // Bot holds 2 blue cards
  });

  it("never returns an illegal move", () => {
    // Run many random scenarios and ensure the bot never proposes an illegal play
    for (let i = 0; i < 50; i++) {
      const deck = shuffle(buildDeck());
      const state = makeState({
        hands: {
          "0": deck.slice(0, 10),
          "1": deck.slice(10, 20),
        },
        discardPile: [deck[20]],
        activeColor: deck[20].color!,
      });

      const move = chooseBotMove(state, "0");

      if (move.type === "PLAY_CARD") {
        const card = state.hands["0"].find((c) => c.id === move.cardId);
        expect(card).toBeDefined();

        // If it's a wild, a chosenColor must be provided
        if (card!.type === "WILD" || card!.type === "WILD_DRAW_FOUR") {
          expect(move.chosenColor).toBeDefined();
        }
      }
    }
  });
});
