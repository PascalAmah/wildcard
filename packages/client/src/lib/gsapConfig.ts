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
 */
export const flightDuration = 0.38;

/**
 * Set up reduced-motion handling via gsap.matchMedia().
 * Call this once at app startup (e.g. in main.tsx or App.tsx).
 *
 * Animations that register via gsap.matchMedia() with this
 * context key will automatically respect the user's preference.
 */
export function setupReducedMotion(): void {
  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: reduce)", () => {
    gsap.set("*", { duration: 0, delay: 0 });
  });
}
