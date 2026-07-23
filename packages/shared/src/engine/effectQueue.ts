/**
 * Composable effect queue for resolving card effects.
 *
 * Rather than special-casing each action card, we represent effects as
 * a small sequence of steps. Each step is processed one at a time before
 * the turn advances.
 *
 * This makes it straightforward to add new card types (like Wild Surge's
 * draw-4 + skip-turn, or Wild Rewind's atomic hand pass) later — they
 * just enqueue different steps.
 */

export type EffectStep =
  | { type: "draw"; count: number; targetPlayerIndex: number }
  | { type: "skipTurn"; targetPlayerIndex: number }
  | { type: "reverseDirection" }
  | { type: "setActiveColor"; color: string };

export class EffectQueue {
  private steps: EffectStep[] = [];

  enqueue(step: EffectStep): void {
    this.steps.push(step);
  }

  dequeue(): EffectStep | undefined {
    return this.steps.shift();
  }

  clear(): void {
    this.steps = [];
  }

  get length(): number {
    return this.steps.length;
  }

  toArray(): EffectStep[] {
    return [...this.steps];
  }
}
