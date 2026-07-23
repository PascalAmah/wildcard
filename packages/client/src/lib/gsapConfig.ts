import gsap from "gsap";
import { Flip } from "gsap/Flip";

// Register the Flip plugin once at import time
gsap.registerPlugin(Flip);

/**
 * Shared easing curve matching the mockup's cubic-bezier(.2,.9,.25,1).
 * GSAP's "power2.out" is the closest named equivalent.
 */
export const easeOut = "power2.out";

/**
 * Standard flight duration for panel transitions, card plays, etc.
 * Ported from the mockup's 380ms timing.
 */
export const flightDuration = 0.38;

/**
 * Shared gsap.matchMedia() instance for reduced-motion support.
 * Components should wrap their GSAP animations inside callbacks
 * registered on this instance so that toggling OS-level
 * reduced-motion collapses all animations to instant state changes.
 *
 * Usage in a component:
 *   reducedMotionMQ.add("(prefers-reduced-motion: no-preference)", (ctx) => {
 *     // create tweens here — only runs when motion is allowed
 *     return () => { /* kill tweens on revert *\/ };
 *   });
 */
export const reducedMotionMQ = gsap.matchMedia();

/**
 * Set up reduced-motion handling via gsap.matchMedia().
 * Call this once at app startup (e.g. in main.tsx or App.tsx).
 *
 * The {@link reducedMotionMQ} instance is the single entry-point
 * that all animated components register into.
 */
export function setupReducedMotion(): void {
  reducedMotionMQ.add("(prefers-reduced-motion: reduce)", (ctx) => {
    // Kill any running tweens when reduced-motion activates and
    // set elements to their final (no-animation) state.
    gsap.globalTimeline.clear();
    return () => {
      // Revert: nothing needed; when the query no longer matches
      // GSAP re-runs the non-reduced-motion callbacks.
    };
  });
}

/**
 * Synchronous check for reduced-motion preference.
 * Use sparingly — prefer {@link reducedMotionMQ} so the browser
 * can re-evaluate the query automatically.
 */
export function isReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
