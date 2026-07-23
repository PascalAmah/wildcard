/**
 * Quick simulation: 4 bot players play a full round using the GameEngine.
 * Prints each move so you can see the engine working.
 *
 * Run: npx tsx packages/shared/simulate.ts
 */

import { GameEngine } from "./src/engine/GameEngine.js";
import { chooseBotMove } from "./src/bots/chooseBotMove.js";
import { canPlay } from "./src/engine/canPlay.js";
import { cardScore } from "./src/engine/applyEffect.js";
import type { Player, CardColor } from "./src/types.js";

const PLAYER_NAMES = ["Alice", "Bob", "Carol", "Dan"];
const WILD_COLORS: CardColor[] = ["red", "blue", "green", "yellow"];

function randomColor(): CardColor {
  return WILD_COLORS[Math.floor(Math.random() * WILD_COLORS.length)];
}

const players: Player[] = PLAYER_NAMES.map((name, i) => ({
  id: String(i),
  name,
  isBot: true,
}));

const engine = new GameEngine("demo-room", players, "midnight", 4);
const state = engine.getState();

console.log("=== WILDCARD — Phase 1 Engine Demo ===\n");
console.log(`Room: ${state.roomId}  |  Players: ${players.length}  |  Theme: ${state.theme}`);
console.log(`Starter card: ${state.discardPile[0].color} ${state.discardPile[0].type}${state.discardPile[0].value != null ? " " + state.discardPile[0].value : ""}\n`);

let turn = 0;
const MAX_TURNS = 2000;

while (turn < MAX_TURNS && state.status === "IN_PROGRESS") {
  turn++;
  const currentState = engine.getState();
  const player = currentState.players[currentState.currentPlayerIndex];
  const hand = currentState.hands[player.id];
  const topCard = currentState.discardPile[currentState.discardPile.length - 1];
  const dir = currentState.direction === 1 ? "→" : "←";

  // Bot decides
  const move = chooseBotMove(currentState, player.id);

  if (move.type === "DRAW_CARD") {
    const drawn = engine.drawCard(player.id);
    console.log(
      `[${String(turn).padStart(3)}] ${dir} ${player.name} drew: ${drawn.color ?? "wild"} ${drawn.type}${drawn.value != null ? " " + drawn.value : ""} (hand: ${hand.length + 1})`,
    );

    // Check if drawn card can be played
    const newState = engine.getState();
    const newTop = newState.discardPile[newState.discardPile.length - 1];

    if (canPlay(drawn, newTop, newState.activeColor)) {
      const playResult = engine.playCard(
        player.id,
        drawn.id,
        drawn.type === "WILD" || drawn.type === "WILD_DRAW_FOUR"
          ? randomColor()
          : undefined,
      );

      if (playResult) {
        console.log(`           ${player.name} plays drawn card and WINS! 🏆`);
        logScores(playResult, currentState);
        break;
      }

      const afterPlay = engine.getState();
      console.log(
        `           ${player.name} plays drawn card → active color: ${afterPlay.activeColor} (hand: ${afterPlay.hands[player.id].length})`,
      );
    } else {
      engine.passTurn(player.id);
      console.log(`           ${player.name} passes turn`);
    }
  } else {
    // Play a card
    const card = hand.find((c) => c.id === move.cardId)!;
    const handBefore = hand.length;

    let chosenColor: CardColor | undefined;
    if (card.type === "WILD" || card.type === "WILD_DRAW_FOUR") {
      chosenColor = move.chosenColor!;
    }

    console.log(
      `[${String(turn).padStart(3)}] ${dir} ${player.name} plays: ${card.color ?? "wild"} ${card.type}${card.value != null ? " " + card.value : ""}${chosenColor ? " → " + chosenColor : ""} (hand: ${handBefore - 1})`,
    );

    const playResult = engine.playCard(player.id, card.id, chosenColor);

    if (playResult) {
      console.log(`           ${player.name} WINS! 🏆`);
      logScores(playResult, currentState);
      break;
    }
  }
}

if (turn >= MAX_TURNS) {
  console.log("\n⚠️  Max turns reached — game did not terminate");
}

function logScores(result: { winnerId: string; scores: Record<string, number> }, state: (typeof engine) extends { getState: () => infer S } ? S : never) {
  const st = engine.getState();
  console.log(`\n=== ROUND OVER ===`);
  const winner = players.find((p) => p.id === result.winnerId)!;
  console.log(`Winner: ${winner.name} — scored ${result.scores[result.winnerId]} points`);
  console.log(`\nFinal hands:`);
  for (const p of players) {
    const hand = st.hands[p.id];
    if (p.id === result.winnerId) {
      console.log(`  ${p.name}: EMPTY (winner!)`);
    } else {
      const cards = hand.map((c) => `${c.color} ${c.type}${c.value != null ? "-" + c.value : ""}`).join(", ");
      const pts = hand.reduce((s, c) => s + cardScore(c), 0);
      console.log(`  ${p.name}: [${cards}] = ${pts} pts`);
    }
  }
}
