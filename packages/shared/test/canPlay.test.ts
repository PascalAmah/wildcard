import { describe, it, expect } from "vitest";
import { canPlay } from "../src/engine/canPlay.js";
import type { Card, CardColor } from "../src/types.js";

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: "1",
    type: "NUMBER",
    color: "red",
    value: 5,
    ...overrides,
  };
}

describe("canPlay", () => {
  const red: CardColor = "red";
  const blue: CardColor = "blue";

  it("allows a color match", () => {
    const result = canPlay(
      card({ type: "NUMBER", color: "red", value: 3 }),
      card({ type: "NUMBER", color: "red", value: 7 }),
      red,
    );
    expect(result).toBe(true);
  });

  it("allows a number match across colors", () => {
    const result = canPlay(
      card({ type: "NUMBER", color: "blue", value: 5 }),
      card({ type: "NUMBER", color: "red", value: 5 }),
      red,
    );
    expect(result).toBe(true);
  });

  it("rejects a card that matches neither color nor number", () => {
    const result = canPlay(
      card({ type: "NUMBER", color: "blue", value: 3 }),
      card({ type: "NUMBER", color: "red", value: 7 }),
      red,
    );
    expect(result).toBe(false);
  });

  it("allows Skip on Skip (type match)", () => {
    const result = canPlay(
      card({ type: "SKIP", color: "blue" }),
      card({ type: "SKIP", color: "red" }),
      red,
    );
    expect(result).toBe(true);
  });

  it("allows Reverse on Reverse (type match)", () => {
    const result = canPlay(
      card({ type: "REVERSE", color: "blue" }),
      card({ type: "REVERSE", color: "red" }),
      red,
    );
    expect(result).toBe(true);
  });

  it("allows Draw Two on Draw Two (type match)", () => {
    const result = canPlay(
      card({ type: "DRAW_TWO", color: "blue" }),
      card({ type: "DRAW_TWO", color: "red" }),
      red,
    );
    expect(result).toBe(true);
  });

  it("allows Skip on Reverse? — no, different action types don't match", () => {
    const result = canPlay(
      card({ type: "SKIP", color: "blue" }),
      card({ type: "REVERSE", color: "red" }),
      red,
    );
    expect(result).toBe(false);
  });

  it("always allows Wild", () => {
    const result = canPlay(
      card({ type: "WILD", color: null, value: null }),
      card({ type: "NUMBER", color: "red", value: 7 }),
      red,
    );
    expect(result).toBe(true);
  });

  it("always allows Wild Draw Four", () => {
    const result = canPlay(
      card({ type: "WILD_DRAW_FOUR", color: null, value: null }),
      card({ type: "NUMBER", color: "red", value: 7 }),
      red,
    );
    expect(result).toBe(true);
  });

  it("allows a color-matched action card", () => {
    const result = canPlay(
      card({ type: "SKIP", color: "red" }),
      card({ type: "NUMBER", color: "red", value: 3 }),
      red,
    );
    expect(result).toBe(true);
  });

  it("rejects an action card with no match", () => {
    const result = canPlay(
      card({ type: "SKIP", color: "blue" }),
      card({ type: "NUMBER", color: "red", value: 3 }),
      red,
    );
    expect(result).toBe(false);
  });

  it("uses activeColor (not topCard's color) for color matching", () => {
    // topCard is red, but activeColor was changed to blue by a previous wild
    const result = canPlay(
      card({ type: "NUMBER", color: "blue", value: 5 }),
      card({ type: "WILD", color: null, value: null }),
      blue,
    );
    expect(result).toBe(true);
  });
});
