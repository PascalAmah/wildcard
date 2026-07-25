import { useRef, useCallback, useLayoutEffect, useMemo, useEffect } from "react";
import gsap from "gsap";
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
    borderColor: isWildCard(card)
      ? "rgba(255,255,255,0.4)"
      : "var(--card-border)",
    background: isWildCard(card)
      ? "linear-gradient(135deg, #2b2f42, #33384f)"
      : cardGradient(card),
    transform: `rotate(${(idx - (total - 1) / 2) * 2}deg)`,
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
  /** Ref to the draw pile's top card element — origin for draw fly-from animation. */
  drawPileEl: HTMLElement | null;
  /** When set, restores this card's visibility — server rejected the play. */
  rejectedCardId?: string | null;
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
  drawPileEl,
  rejectedCardId,
}: HandProps) {
  const handRef = useRef<HTMLDivElement>(null);
  const shakeTargets = useRef<Map<string, HTMLElement>>(new Map());
  const beforeRectsRef = useRef<Map<string, DOMRect> | null>(null);
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

  // Capture bounding rects BEFORE React re-render (same technique as mockup)
  const cardsKey = cards.map((c) => c.id).join(",");
  const prevKey = useRef("");
  if (cardsKey !== prevKey.current && handRef.current) {
    const rects = new Map<string, DOMRect>();
    handRef.current.querySelectorAll(".hcard").forEach((el) => {
      const id = (el as HTMLElement).dataset.cardId;
      if (id) rects.set(id, el.getBoundingClientRect());
    });
    beforeRectsRef.current = rects;
  }
  prevKey.current = cardsKey;

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

  // ---- Apply position shifts + new-card entrance AFTER React commit ----
  useLayoutEffect(() => {
    if (!handRef.current || isReducedMotion()) return;

    const beforeRects = beforeRectsRef.current;
    beforeRectsRef.current = null;

    // Shift remaining cards from old positions to new (FLIP-like)
    if (beforeRects) {
      handRef.current.querySelectorAll(".hcard").forEach((el) => {
        const htmlEl = el as HTMLElement;
        const id = htmlEl.dataset.cardId;
        if (!id) return;
        const before = beforeRects.get(id);
        if (!before) return; // new card — handled separately
        const after = el.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (dx !== 0 || dy !== 0) {
          // Animate from old position to new, preserving the inline rotate.
          const finalTransform = htmlEl.style.transform;
          const fromTransform = "translate(" + dx + "px, " + dy + "px)" + (finalTransform ? " " + finalTransform : "");
          gsap.fromTo(
            htmlEl,
            { transform: fromTransform },
            { transform: finalTransform || "none", duration: 0.35, ease: easeOut },
          );
        }
      });
    }

    // Animate newly-arrived cards
    // Single new card + draw pile ref = draw → fly from draw pile.
    // Multiple new cards = initial deal → rise-and-fade.
    const isDraw = newCardIds.size === 1 && drawPileEl;

    if (isDraw) {
      const id = [...newCardIds][0];
      const el = cardEls.current.get(id);
      if (el) {
        const drawRect = drawPileEl!.getBoundingClientRect();
        const cardRect = el.getBoundingClientRect();
        const dx = drawRect.left + drawRect.width / 2 - (cardRect.left + cardRect.width / 2);
        const dy = drawRect.top + drawRect.height / 2 - (cardRect.top + cardRect.height / 2);

        const finalTransform = el.style.transform;
        gsap.fromTo(
          el,
          {
            x: dx,
            y: dy,
            scale: 0.5,
            opacity: 0,
            transform: `translate(${dx}px, ${dy}px) scale(0.5)`,
          },
          {
            x: 0,
            y: 0,
            scale: 1,
            opacity: 1,
            transform: finalTransform || "none",
            duration: flightDuration,
            ease: easeOut,
          },
        );
      }
    } else {
      for (const id of newCardIds) {
        const el = cardEls.current.get(id);
        if (el) {
          const finalTransform = el.style.transform;
          const fromTransform = "translateY(20px)" + (finalTransform ? " " + finalTransform : "");
          gsap.fromTo(
            el,
            { transform: fromTransform, opacity: 0 },
            { transform: finalTransform || "none", opacity: 1, duration: 0.3, ease: easeOut },
          );
        }
      }
    }
  }, [cardsKey]);

  useEffect(() => {
    prevCardIds.current = new Set(cards.map((c) => c.id));
  }, [cards]);

  // Restore a card's visibility when the server rejects the play.
  // The card was dimmed by the fly animation; rejection means no
  // game:state was sent, so the element is still in the DOM at 0.3 opacity.
  useEffect(() => {
    if (!rejectedCardId || isReducedMotion()) return;
    const el = cardEls.current.get(rejectedCardId);
    if (el) {
      gsap.to(el, { opacity: 1, scale: 1, duration: 0.2, ease: "power2.out" });
    }
  }, [rejectedCardId]);

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

      // Dim the source card during flight — don't fully hide it.
      // If the server rejects the play (NOT_YOUR_TURN, ILLEGAL_MOVE),
      // the card stays in the array and we restore it via rejectedCardId.
      // If the server confirms, the card is naturally removed from the
      // array on the next game:state and the element disappears.
      gsap.set(sourceEl, { opacity: 0.3, scale: 0.95 });

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

  const total = cards.length;

  return (
    <div className="flex flex-col pb-1">
      {total > 0 && (
        <div className="text-[12px] font-semibold text-center text-[var(--ink-dim)] pb-1">
          Your hand
        </div>
      )}

      <div
        ref={handRef}
        className="overflow-x-auto overflow-y-visible scrollbar-none pt-11 pb-5"
      >
        {total === 0 ? (
          <div className="flex items-center justify-center h-[130px] text-[var(--ink-dim)] text-[14px]">
            No cards in hand
          </div>
        ) : (
          <div
            className="flex items-end mx-auto w-fit"
            style={{
              perspective: "1000px",
              gap: total > 10 ? "-24px" : total > 7 ? "-18px" : "-14px",
            }}
          >
            {cards.map((card, idx) => {
              const isWild = isWildCard(card);
              const isLegal = canPlay(card, topCard, activeColor);
              const isClickable = isMyTurn && isLegal;

              return (
                <div
                  key={card.id}
                  className={`flex-shrink-0 transition-transform duration-200 ease-out ${
                    isClickable
                      ? "-translate-y-3.5 hover:-translate-y-[28px] hover:z-10"
                      : ""
                  }`}
                  style={{ marginLeft: idx === 0 ? "0" : "-14px", zIndex: idx }}
                >
                <div
                  ref={(el) => registerCard(card.id, el)}
                  data-card-id={card.id}
                  className={`hcard relative w-[60px] h-[88px] sm:w-[72px] sm:h-[105px] rounded-xl border-2 flex flex-col items-center justify-center select-none transition-all duration-200 ease-out ${
                    isClickable
                      ? "cursor-pointer shadow-[0_4px_0_rgba(0,0,0,0.15),0_14px_26px_-8px_rgba(0,0,0,0.55),0_0_0_2px_rgba(255,255,255,0.35)] hover:shadow-[0_20px_34px_-8px_rgba(0,0,0,0.6),0_0_0_2px_rgba(255,255,255,0.35)]"
                      : "cursor-not-allowed opacity-40"
                  }`}
                  style={cardInlineStyle(card, idx, total)}
                  onClick={() => handleCardClick(card)}
                >
                  {/* Corner badge — top-left */}
                  <span className="absolute top-1 left-1.5 text-[9px] font-[Fredoka] font-bold text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
                    {cardLabel(card)}
                  </span>

                  {/* Center label */}
                  <span
                    className="font-[Fredoka] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                    style={{ fontSize: isWild ? "18px" : "22px" }}
                  >
                    {cardLabel(card)}
                  </span>

                  {/* Corner badge — bottom-right (rotated for symmetry) */}
                  <span className="absolute bottom-1 right-1.5 text-[9px] font-[Fredoka] font-bold text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)] rotate-180">
                    {cardLabel(card)}
                  </span>

                  {/* Wild star indicator */}
                  {isWild && (
                    <span className="absolute bottom-1 left-1.5 text-[9px] font-[Fredoka] font-bold text-white/60">
                      ★
                    </span>
                  )}
                </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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

  gsap.set(sourceEl, { opacity: 0.3, scale: 0.95 });

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
