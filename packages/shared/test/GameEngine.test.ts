import { describe, it, expect } from "vitest";
import { GameEngine } from "../src/engine/GameEngine.js";
import { canPlay } from "../src/engine/canPlay.js";
import type { Player, Card } from "../src/types.js";

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    name: `Player ${i}`,
    isBot: true,
  }));
}

describe("GameEngine", () => {
  describe("initialization", () => {
    it("deals 7 cards to each player", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();

      for (const player of players) {
        expect(state.hands[player.id]).toHaveLength(7);
      }
    });

    it("sets the discard pile with a non-chaos starter card", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();

      expect(state.discardPile).toHaveLength(1);
      const starter = state.discardPile[0];
      expect(starter.type).not.toBe("WILD");
      expect(starter.type).not.toBe("WILD_DRAW_FOUR");
      expect(starter.color).not.toBeNull();
    });

    it("sets activeColor from the starter card", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();

      expect(state.activeColor).toBe(state.discardPile[0].color);
    });

    it("starts at player index 0 with clockwise direction", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();

      expect(state.currentPlayerIndex).toBe(0);
      expect(state.direction).toBe(1);
    });
  });

  describe("playCard", () => {
    it("rejects a move from the wrong player", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();
      const card = state.hands["1"][0];

      expect(() => engine.playCard("1", card.id)).toThrow("NOT_YOUR_TURN");
    });

    it("rejects an illegal move", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();
      const hand = state.hands["0"];

      const topCard = state.discardPile[state.discardPile.length - 1];
      const illegalCard = hand.find(
        (c) => !canPlay(c, topCard, state.activeColor),
      );

      if (illegalCard) {
        expect(() => engine.playCard("0", illegalCard.id)).toThrow(
          "ILLEGAL_MOVE",
        );
      }
    });

    it("moves the played card to the discard pile and advances turn", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();

      // Draw cards until player "0" has a legal move
      let cardId: string | undefined;
      let chosenColor: string | undefined;
      for (let i = 0; i < 10; i++) {
        const hand = state.hands["0"];
        const topCard = state.discardPile[state.discardPile.length - 1];

        const nonWild = hand.find(
          (c) =>
            canPlay(c, topCard, state.activeColor) &&
            c.type !== "WILD" &&
            c.type !== "WILD_DRAW_FOUR",
        );

        if (nonWild) {
          cardId = nonWild.id;
          break;
        }

        const wildCard = hand.find(
          (c) => c.type === "WILD" || c.type === "WILD_DRAW_FOUR",
        );
        if (wildCard) {
          cardId = wildCard.id;
          chosenColor = "red";
          break;
        }

        // No legal move — draw a card (as if it's player 0's turn)
        engine.drawCard("0");
      }

      expect(cardId).toBeDefined();
      engine.playCard("0", cardId!, chosenColor as any);

      const newState = engine.getState();
      expect(
        newState.discardPile[newState.discardPile.length - 1].id,
      ).toBe(cardId);
      expect(newState.hands["0"].find((c) => c.id === cardId)).toBeUndefined();
      expect(newState.currentPlayerIndex).toBe(1);
    });
  });

  describe("drawCard and passTurn", () => {
    it("draws a card but does NOT advance the turn", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();
      const initialHandSize = state.hands["0"].length;
      const initialDrawPileSize = state.drawPile.length;

      const drawn = engine.drawCard("0");
      expect(drawn).toBeDefined();

      const newState = engine.getState();
      expect(newState.hands["0"]).toHaveLength(initialHandSize + 1);
      expect(newState.drawPile).toHaveLength(initialDrawPileSize - 1);
      // Turn should NOT have advanced — player may play the drawn card
      expect(newState.currentPlayerIndex).toBe(0);
    });

    it("passTurn advances to the next player", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);

      engine.drawCard("0"); // draw, turn stays at 0
      engine.passTurn("0"); // now end turn

      expect(engine.getState().currentPlayerIndex).toBe(1);
    });

    it("can play a drawn card on the same turn", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();

      const drawn = engine.drawCard("0");
      const topCard = state.discardPile[state.discardPile.length - 1];

      if (canPlay(drawn, topCard, state.activeColor)) {
        const isWild =
          drawn.type === "WILD" || drawn.type === "WILD_DRAW_FOUR";
        engine.playCard("0", drawn.id, isWild ? "red" : undefined);
        const newState = engine.getState();
        expect(newState.currentPlayerIndex).toBe(1);
        expect(
          newState.hands["0"].find((c) => c.id === drawn.id),
        ).toBeUndefined();
      } else {
        engine.passTurn("0");
        expect(engine.getState().currentPlayerIndex).toBe(1);
      }
    });

    it("rejects draw from wrong player", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);

      expect(() => engine.drawCard("1")).toThrow("NOT_YOUR_TURN");
    });

    it("rejects passTurn from wrong player", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);

      expect(() => engine.passTurn("1")).toThrow("NOT_YOUR_TURN");
    });
  });

  describe("onTurnTimeout", () => {
    it("auto-draws one card and advances turn", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();
      const initialHandSize = state.hands["0"].length;

      engine.onTurnTimeout("0");

      const newState = engine.getState();
      expect(newState.hands["0"]).toHaveLength(initialHandSize + 1);
      expect(newState.currentPlayerIndex).toBe(1);
    });

    it("is a no-op if called for the wrong player", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();
      const initialIndex = state.currentPlayerIndex;

      engine.onTurnTimeout("1");
      expect(engine.getState().currentPlayerIndex).toBe(initialIndex);
    });
  });

  describe("toClientView", () => {
    it("includes the player's own hand in full", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();
      const view = engine.toClientView("0");

      expect(view.myHand).toEqual(state.hands["0"]);
      expect(view.myHand).toHaveLength(7);
    });

    it("redacts other players' hands to counts", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);
      const view = engine.toClientView("0");

      for (const p of view.players) {
        expect(p.handCount).toBe(7);
      }
    });
  });

  describe("full round simulation", () => {
    it("always terminates with a winner and correct scores (4 players)", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);

      let maxIterations = 1000;
      let result = null;

      while (maxIterations > 0 && result === null) {
        maxIterations--;
        const state = engine.getState();
        const currentPlayerId =
          state.players[state.currentPlayerIndex].id;
        const hand = state.hands[currentPlayerId];
        const topCard = state.discardPile[state.discardPile.length - 1];

        const playable = hand.filter((c) =>
          canPlay(c, topCard, state.activeColor),
        );

        if (playable.length > 0) {
          const chosen = playable[0];
          let chosenColor: string | undefined;

          if (chosen.type === "WILD" || chosen.type === "WILD_DRAW_FOUR") {
            chosenColor = "red";
          }

          try {
            result = engine.playCard(
              currentPlayerId,
              chosen.id,
              chosenColor as any,
            );
          } catch {
            engine.drawCard(currentPlayerId);
            engine.passTurn(currentPlayerId);
          }
        } else {
          engine.drawCard(currentPlayerId);
          engine.passTurn(currentPlayerId);
        }
      }

      expect(result).not.toBeNull();
      expect(result!.winnerId).toBeDefined();
      expect(result!.scores[result!.winnerId]).toBeGreaterThan(0);

      // Winner's score should equal sum of all other players' hand values
      const state = engine.getState();
      let expectedTotal = 0;
      for (const player of players) {
        if (player.id !== result!.winnerId) {
          for (const card of state.hands[player.id]) {
            if (card.type === "NUMBER") {
              expectedTotal += card.value ?? 0;
            } else if (
              card.type === "SKIP" ||
              card.type === "REVERSE" ||
              card.type === "DRAW_TWO"
            ) {
              expectedTotal += 20;
            } else {
              expectedTotal += 50;
            }
          }
        }
      }
      expect(result!.scores[result!.winnerId]).toBe(expectedTotal);
    });

    it("always terminates with a winner (2 players)", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);

      let maxIterations = 1000;
      let result = null;

      while (maxIterations > 0 && result === null) {
        maxIterations--;
        const state = engine.getState();
        const currentPlayerId =
          state.players[state.currentPlayerIndex].id;
        const hand = state.hands[currentPlayerId];
        const topCard = state.discardPile[state.discardPile.length - 1];

        const playable = hand.filter((c) =>
          canPlay(c, topCard, state.activeColor),
        );

        if (playable.length > 0) {
          const chosen = playable[0];
          let chosenColor: string | undefined;

          if (chosen.type === "WILD" || chosen.type === "WILD_DRAW_FOUR") {
            chosenColor = "red";
          }

          try {
            result = engine.playCard(
              currentPlayerId,
              chosen.id,
              chosenColor as any,
            );
          } catch {
            engine.drawCard(currentPlayerId);
            engine.passTurn(currentPlayerId);
          }
        } else {
          engine.drawCard(currentPlayerId);
          engine.passTurn(currentPlayerId);
        }
      }

      expect(result).not.toBeNull();
      expect(result!.winnerId).toBeDefined();
    });
  });

  describe("draw pile reshuffle", () => {
    it("reshuffles discard pile into draw pile when draw pile empties", () => {
      const players = makePlayers(2);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();

      // Force empty draw pile and populate discard pile with many cards
      // by directly manipulating state (test utility)
      state.drawPile.length = 0;
      const { hands } = state;
      // Move all of player 1's cards to the discard pile to simulate
      // a game where the draw pile ran dry
      state.discardPile.push(...hands["1"]);
      hands["1"] = [];

      // Now draw should trigger reshuffle
      const drawn = engine.drawCard("0");
      expect(drawn).toBeDefined();
      expect(drawn.id).toBeDefined();

      // Should have rebuilt the draw pile from discarded cards (except the top)
      expect(engine.getState().drawPile.length).toBeGreaterThan(0);
    });
  });

  describe("reverse direction", () => {
    it("reverses direction and advances to the correct player", () => {
      const players = makePlayers(4);
      const engine = new GameEngine("room1", players);
      const state = engine.getState();

      const hand = state.hands["0"];
      const reverse = hand.find((c) => c.type === "REVERSE");

      if (reverse) {
        const topCard = state.discardPile[state.discardPile.length - 1];
        if (canPlay(reverse, topCard, state.activeColor)) {
          engine.playCard("0", reverse.id);
          const newState = engine.getState();
          expect(newState.direction).toBe(-1);
          // With 4 players, clockwise next is 1, counter-clockwise next is 3
          expect(newState.currentPlayerIndex).toBe(3);
        }
      }
    });
  });
});
