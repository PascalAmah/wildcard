/**
 * Haptic feedback utilities wrapping navigator.vibrate.
 *
 * iOS Safari does not support navigator.vibrate, so all calls
 * are guarded by a feature-detection no-op.
 */

function canVibrate(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

/** Quick 10ms tap — good for card taps, button presses. */
export function hapticPlay(): void {
  if (!canVibrate()) return;
  navigator.vibrate(10);
}

/** Short 15ms buzz — good for drawing a card. */
export function hapticDraw(): void {
  if (!canVibrate()) return;
  navigator.vibrate(15);
}

/** Three-pulse error pattern — good for illegal moves. */
export function hapticInvalid(): void {
  if (!canVibrate()) return;
  navigator.vibrate([30, 50, 30, 50, 30]);
}
