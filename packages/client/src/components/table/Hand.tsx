import { useRef, useCallback, useLayoutEffect, useMemo, useEffect } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { canPlay } from "@wildcard/shared";
import type { Card, CardColor } from "@wildcard/shared";
import { hapticPlay, hapticInvalid } from "../../hooks/useHaptics";
import { easeOut, flightDuration, isReducedMotion } from "../../lib/gsapConfig";
import type { ToastMessage } from "../shared/Toast";

// ---------- helpers ----------

const colorHex: Record<CardColor, { light: string; dark: string }> = {
  green: { light: "#34c77b", dark: "#229a5f" },
  red: { light: "#ef5b68", dark: "#cf3b48" },
  yellow: { light: "#f2b341", dark: "#d5940f" },
  blue: { light: "#4c6ef5", dark: "#3450d1" },
};

function cardLabel(card: Card): string {
  if (card.type === "NUMBER") return String(card.value ?? "");
  if (card.type === "SKIP") return "\u2298";
  if (card.type === "REVERSE") return "\u21C4";
  if (card.type === "DRAW_TWO") return "+2";
  if (card.type === "WILD") return "\u2605";
  if (card.type === "WILD_DRAW_FOUR") return "+4";
  return "";
}

function cardGradient(card: Card): string {
  if (!card.color) return "transparent";
  const c = colorHex[card.color];
  return `linear-gradient(160deg, ${c.light}, ${c.dark})`;
}

function isWildCard(card: Card): boolean {
  return card.type === "WILD" || card.type === "WILD_DRAW_FOUR";
}

function cardInlineStyle(
  card: Card,
  idx: number,
  total: number,
): React.CSSProperties {
  return {
    marginLeft: idx === 0 ? "0" : "-16px",
    zIndex: idx,
    borderColor: isWildCard(card)
      ? "rgba(255,255,255,0.4)"
      : "var(--card-border)",
    background: isWildCard(card)
      ? "linear-gradient(135deg, #2b2f42, #33384f)"
      : cardGradient(card),
    transform: `rotate(${(idx - (total - 1) / 2) * 2}deg)`,
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  };
}

// ---------- component ----------

interface HandProps {
  cards: Card[];
  onPlayCard: (cardId: string, chosenColor?: CardColor) => void;
  activeColor: CardColor;
  topCard: Card;
  isMyTurn: boolean;
  onIllegalPlay?: () => void;
  onToast?: (msg: Omit<ToastMessage, "id">) => void;
  /** Ref to the discard pile's card element — target for fly-to animation. */
  discardPileEl: HTMLElement | null;
}

export default function Hand({
  cards,
  onPlayCard,
  activeColor,
  topCard,
  isMyTurn,
  onIllegalPlay,
  onToast,
  discardPileEl,
}: HandProps) {
  const handRef = useRef<HTMLDivElement>(null);
  const shakeTargets = useRef<Map<string, HTMLElement>>(new Map());
  const flipStateRef = useRef<Flip.FlipState | null>(null);
  const prevCardsKey = useRef("");
  // Track which cards just entered so we can animate them
  const prevCardIds = useRef<Set<string>>(new Set());
  // Map card ID → its DOM element for the fly-out clone
  const cardEls = useRef<Map<string, HTMLElement>>(new Map());

  const registerCard = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      shakeTargets.current.set(id, el);
      cardEls.current.set(id, el);
    } else {
      shakeTargets.current.delete(id);
      cardEls.current.delete(id);
    }
  }, []);

  // ---- GSAP Flip: capture old positions BEFORE React re-render ----
  const cardsKey = cards.map((c) => c.id).join(",");
  if (cardsKey !== prevCardsKey.current && handRef.current) {
    flipStateRef.current = Flip.getState(".hcard", {
      props: "transform",
    });
  }

  // Detect new cards for entrance animation
  const newCardIds = useMemo(() => {
    const currentIds = new Set(cards.map((c) => c.id));
    const newIds = new Set<string>();
    for (const id of currentIds) {
      if (!prevCardIds.current.has(id)) {
        newIds.add(id);
      }
    }
    return newIds;
  }, [cards]);

  prevCardsKey.current = cardsKey;

  // ---- Apply Flip reflow + new-card entrance AFTER React commit ----
  useLayoutEffect(() => {
    if (!handRef.current) return;
    if (isReducedMotion()) return;

    const state = flipStateRef.current;
    flipStateRef.current = null;

    // Flip-reflow the remaining cards
    if (state) {
      Flip.from(state, {
        duration: 0.35,
        ease: easeOut,
        absolute: true,
        toggleClass: "flipping",
      });
    }

    // Animate newly-arrived cards: rise-and-fade (port from mockup)
    for (const id of newCardIds) {
      const el = cardEls.current.get(id);
      if (el) {
        gsap.fromTo(
          el,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.3, ease: easeOut },
        );
      }
    }
  }, [cardsKey]);

  useEffect(() => {
    prevCardIds.current = new Set(cards.map((c) => c.id));
  }, [cards]);

  // ---- Fly-to-discard animation ----
  const flyCardToDiscardPile = useCallback(
    (cardId: string, onComplete: () => void) => {
      const sourceEl = cardEls.current.get(cardId);
      const targetEl = discardPileEl;

      if (!sourceEl || !targetEl || isReducedMotion()) {
        onComplete();
        return;
      }

      // Get the screen positions for source and target
      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
      const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);

      // Clone the card element for the flight
      const clone = sourceEl.cloneNode(true) as HTMLElement;
      clone.style.position = "fixed";
      clone.style.left = `${sourceRect.left}px`;
      clone.style.top = `${sourceRect.top}px`;
      clone.style.width = `${sourceRect.width}px`;
      clone.style.height = `${sourceRect.height}px`;
      clone.style.zIndex = "9999";
      clone.style.pointerEvents = "none";
      clone.style.margin = "0";
      document.body.appendChild(clone);

      // Hide the source card instantly
      gsap.set(sourceEl, { opacity: 0, scale: 0.95 });

      // Build the flight timeline
      const tl = gsap.timeline({
        onComplete: () => {
          // Remove the clone
          clone.remove();
          onComplete();
        },
      });

      // Flight arc: fly to discard pile with slight scale-down and rotation
      tl.to(clone, {
        x: deltaX,
        y: deltaY,
        scale: 0.6,
        rotation: 15,
        duration: flightDuration,
        ease: easeOut,
      });

      // Add a subtle vertical arc via keyframes
      tl.to(
        clone,
        {
          y: deltaY - 30, // slight lift at midpoint
          duration: flightDuration * 0.4,
          ease: "power2.out",
        },
        0,
      );
      tl.to(
        clone,
        { y: deltaY, duration: flightDuration * 0.6, ease: "power2.in" },
        flightDuration * 0.4,
      );
    },
    [discardPileEl],
  );

  // ---- Card click handler ----
  function handleCardClick(card: Card) {
    if (!isMyTurn) return;

    const legal = canPlay(card, topCard, activeColor);

    if (!legal) {
      // Shake the card
      const el = shakeTargets.current.get(card.id);
      if (el && !isReducedMotion()) {
        gsap.fromTo(
          el,
          { xPercent: 0 },
          {
            xPercent: 4,
            duration: 0.06,
            repeat: 5,
            yoyo: true,
            ease: "power1.inOut",
            onComplete: () => gsap.set(el, { xPercent: 0 }),
          },
        );
      }

      hapticInvalid();
      onIllegalPlay?.();
      onToast?.({ message: "Illegal move — card doesn't match", type: "error" });
      return;
    }

    // Wild cards without a color choice: let the parent show the picker first.
    // The parent will call flyCardToDiscardPile via HTMLElement dispatch / ref later.
    if (isWildCard(card) && card.color === null) {
      hapticPlay();
      onPlayCard(card.id);
      return;
    }

    // Legal non-wild (or wild with pre-selected color): fly → emit
    flyCardToDiscardPile(card.id, () => {
      hapticPlay();
      onPlayCard(card.id);
    });
  }

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-[130px] text-[var(--ink-dim)] text-[14px]">
        No cards in hand
      </div>
    );
  }

  const total = cards.length;

  return (
    <div
      ref={handRef}
      className="flex items-end justify-center gap-[-16px] px-4"
      style={{ perspective: "1000px" }}
    >
      {cards.map((card, idx) => {
        const isWild = isWildCard(card);
        const isLegal = canPlay(card, topCard, activeColor);
        const isClickable = isMyTurn && isLegal;

        return (
          <div
            key={card.id}
            ref={(el) => registerCard(card.id, el)}
            data-card-id={card.id}
            className={`hcard relative flex-shrink-0 w-[84px] h-[122px] rounded-xl border-2 flex flex-col items-center justify-center select-none transition-shadow duration-150 ${
              isClickable
                ? "cursor-pointer hover:shadow-[0_0_16px_rgba(255,255,255,0.2)] hover:-translate-y-3"
                : "cursor-default"
            } ${isLegal && isMyTurn ? "hover:-translate-y-3" : ""}`}
            style={cardInlineStyle(card, idx, total)}
            onClick={() => handleCardClick(card)}
          >
            {/* Corner badge — top-left */}
            <span className="absolute top-1.5 left-2 text-[10px] font-[Fredoka] font-bold text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
              {cardLabel(card)}
            </span>

            {/* Center label */}
            <span
              className="font-[Fredoka] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
              style={{ fontSize: isWild ? "22px" : "26px" }}
            >
              {cardLabel(card)}
            </span>

            {/* Corner badge — bottom-right (rotated for symmetry) */}
            <span className="absolute bottom-1.5 right-2 text-[10px] font-[Fredoka] font-bold text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)] rotate-180">
              {cardLabel(card)}
            </span>

            {/* Wild star indicator */}
            {isWild && (
              <span className="absolute bottom-1.5 left-2 text-[10px] font-[Fredoka] font-bold text-white/60">
                ★
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * External helper: programmatically trigger fly-to-discard for a card.
 * Used by TablePage after a wild color has been chosen.
 *
 * Looks up the card's DOM element by `data-card-id`, clones it,
 * animates it to the target discard-pile element, then calls `onComplete`.
 *
 * If `targetEl` is null or reduced-motion is active, `onComplete` is
 * called immediately (no animation).
 */
export function executeFlyToDiscard(
  cardId: string,
  targetEl: HTMLElement | null,
  onComplete: () => void,
): void {
  const sourceEl = document.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement | null;
  if (!sourceEl || !targetEl || isReducedMotion()) {
    onComplete();
    return;
  }

  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  const deltaX = targetRect.left + targetRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const deltaY = targetRect.top + targetRect.height / 2 - (sourceRect.top + sourceRect.height / 2);

  const clone = sourceEl.cloneNode(true) as HTMLElement;
  clone.style.position = "fixed";
  clone.style.left = `${sourceRect.left}px`;
  clone.style.top = `${sourceRect.top}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.zIndex = "9999";
  clone.style.pointerEvents = "none";
  clone.style.margin = "0";
  document.body.appendChild(clone);

  gsap.set(sourceEl, { opacity: 0, scale: 0.95 });

  const tl = gsap.timeline({ onComplete: () => { clone.remove(); onComplete(); } });

  tl.to(clone, {
    x: deltaX,
    y: deltaY - 30,
    scale: 0.6,
    rotation: 15,
    duration: flightDuration * 0.4,
    ease: "power2.out",
  });

  tl.to(clone, {
    x: deltaX,
    y: deltaY,
    scale: 0.5,
    rotation: 5,
    duration: flightDuration * 0.6,
    ease: "power2.in",
  });
}
