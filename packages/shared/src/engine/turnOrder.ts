/**
 * Direction-aware "who's next" logic.
 * direction is always 1 (clockwise) or -1 (reversed).
 */

/**
 * Get the index of the next player in turn order, accounting for direction.
 * Wraps around the player count.
 */
export function getNextPlayerIndex(
  currentIndex: number,
  direction: 1 | -1,
  playerCount: number,
): number {
  const next = currentIndex + direction;
  if (next < 0) return playerCount - 1;
  if (next >= playerCount) return 0;
  return next;
}

/**
 * Skip a player: advance by two steps instead of one.
 * Used when a Skip or Draw Two was played (the next player loses their turn).
 */
export function getSkippedPlayerIndex(
  currentIndex: number,
  direction: 1 | -1,
  playerCount: number,
): number {
  const first = getNextPlayerIndex(currentIndex, direction, playerCount);
  return getNextPlayerIndex(first, direction, playerCount);
}
