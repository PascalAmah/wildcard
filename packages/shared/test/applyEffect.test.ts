import { describe, it, expect } from "vitest";
import { applyEffect, cardScore } from "../src/engine/applyEffect.js";
import { EffectQueue } from "../src/engine/effectQueue.js";
import type { Card, CardColor } from "../src/types.js";

function numberCard(color: CardColor, value: number): Card {
  return { id: `${color}-${value}`, type: "NUMBER", color, value };
}

function skipCard(color: CardColor): Card {
  return { id: `skip-${color}`, type: "SKIP", color, value: null };
}

function reverseCard(color: CardColor): Card {
  return { id: `reverse-${color}`, type: "REVERSE", color, value: null };
}

function drawTwoCard(color: CardColor): Card {
  return { id: `draw2-${color}`, type: "DRAW_TWO", color, value: null };
}

function wildCard(): Card {
  return { id: "wild", type: "WILD", color: null, value: null };
}

function wildDrawFourCard(): Card {
  return { id: "wdf", type: "WILD_DRAW_FOUR", color: null, value: null };
}

describe("applyEffect", () => {
  describe("Skip", () => {
    it("enqueues a skipTurn effect for the next player", () => {
      const queue = new EffectQueue();
      const result = applyEffect(
        skipCard("red"),
        0, // currentPlayerIndex
        1, // direction
        4, // playerCount
        queue,
      );

      expect(result).toBe("red");
      const steps = queue.toArray();
      expect(steps).toHaveLength(1);
      expect(steps[0]).toEqual({ type: "skipTurn", targetPlayerIndex: 2 }); // skip index 1, land on 2
    });
  });

  describe("Reverse", () => {
    it("enqueues a reverseDirection effect", () => {
      const queue = new EffectQueue();
      const result = applyEffect(
        reverseCard("blue"),
        0, // currentPlayerIndex
        1, // direction
        4, // playerCount
        queue,
      );

      expect(result).toBe("blue");
      const steps = queue.toArray();
      expect(steps[0]).toEqual({ type: "reverseDirection" });
    });

    it("also acts as Skip in a 2-player game", () => {
      const queue = new EffectQueue();
      applyEffect(
        reverseCard("green"),
        0, // currentPlayerIndex
        1, // direction
        2, // playerCount
        queue,
      );

      const steps = queue.toArray();
      expect(steps).toHaveLength(2);
      expect(steps[0]).toEqual({ type: "reverseDirection" });
      expect(steps[1]).toEqual({ type: "skipTurn", targetPlayerIndex: 0 }); // wraps around
    });
  });

  describe("Draw Two", () => {
    it("enqueues draw(2) + skipTurn", () => {
      const queue = new EffectQueue();
      const result = applyEffect(
        drawTwoCard("yellow"),
        0,
        1,
        4,
        queue,
      );

      expect(result).toBe("yellow");
      const steps = queue.toArray();
      expect(steps).toHaveLength(2);
      expect(steps[0]).toEqual({ type: "draw", count: 2, targetPlayerIndex: 1 });
      expect(steps[1]).toEqual({ type: "skipTurn", targetPlayerIndex: 2 });
    });
  });

  describe("Wild", () => {
    it("returns the chosen color", () => {
      const queue = new EffectQueue();
      const result = applyEffect(
        wildCard(),
        0,
        1,
        4,
        queue,
        "blue",
      );

      expect(result).toBe("blue");
      expect(queue.length).toBe(0); // no effects beyond color declaration
    });

    it("throws if chosenColor is missing", () => {
      const queue = new EffectQueue();
      expect(() =>
        applyEffect(wildCard(), 0, 1, 4, queue, undefined),
      ).toThrow("chosenColor is required");
    });
  });

  describe("Wild Draw Four", () => {
    it("enqueues draw(4) + skipTurn and returns chosen color", () => {
      const queue = new EffectQueue();
      const result = applyEffect(
        wildDrawFourCard(),
        0,
        1,
        4,
        queue,
        "green",
      );

      expect(result).toBe("green");
      const steps = queue.toArray();
      expect(steps).toHaveLength(2);
      expect(steps[0]).toEqual({ type: "draw", count: 4, targetPlayerIndex: 1 });
      expect(steps[1]).toEqual({ type: "skipTurn", targetPlayerIndex: 2 });
    });

    it("throws if chosenColor is missing", () => {
      const queue = new EffectQueue();
      expect(() =>
        applyEffect(wildDrawFourCard(), 0, 1, 4, queue, undefined),
      ).toThrow("chosenColor is required");
    });
  });

  describe("Number", () => {
    it("returns the card's color with no effects", () => {
      const queue = new EffectQueue();
      const result = applyEffect(
        numberCard("red", 7),
        0,
        1,
        4,
        queue,
      );

      expect(result).toBe("red");
      expect(queue.length).toBe(0);
    });
  });
});

describe("cardScore", () => {
  it("returns face value for number cards", () => {
    expect(cardScore(numberCard("red", 0))).toBe(0);
    expect(cardScore(numberCard("blue", 5))).toBe(5);
    expect(cardScore(numberCard("green", 9))).toBe(9);
  });

  it("returns 20 for action cards", () => {
    expect(cardScore(skipCard("red"))).toBe(20);
    expect(cardScore(reverseCard("red"))).toBe(20);
    expect(cardScore(drawTwoCard("red"))).toBe(20);
  });

  it("returns 50 for wild cards", () => {
    expect(cardScore(wildCard())).toBe(50);
    expect(cardScore(wildDrawFourCard())).toBe(50);
  });
});
