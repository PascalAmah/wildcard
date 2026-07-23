import { useRef, useCallback, useLayoutEffect } from "react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { canPlay } from "@wildcard/shared";
import type { Card, CardColor } from "@wildcard/shared";
import { hapticPlay, hapticInvalid } from "../../hooks/useHaptics";
import { easeOut } from "../../lib/gsapConfig";
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

// ---------- component ----------

interface HandProps {
  cards: Card[];
  onPlayCard: (cardId: string, chosenColor?: CardColor) => void;
  activeColor: CardColor;
  topCard: Card;
  isMyTurn: boolean;
  onIllegalPlay?: () => void;
  /** Callback to enqueue a toast message */
  onToast?: (msg: Omit<ToastMessage, "id">) => void;
}

export default function Hand({
  cards,
  onPlayCard,
  activeColor,
  topCard,
  isMyTurn,
  onIllegalPlay,
  onToast,
}: HandProps) {
  const handRef = useRef<HTMLDivElement>(null);
  const shakeTargets = useRef<Map<string, HTMLElement>>(new Map());
  // Stores the Flip state captured during render (before DOM commit)
  const flipStateRef = useRef<Flip.FlipState | null>(null);
  // Track the serialized card IDs to know when the hand actually changes
  const prevCardsKey = useRef("");

  // Register each card element for shake targeting
  const registerCard = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      shakeTargets.current.set(id, el);
    } else {
      shakeTargets.current.delete(id);
    }
  }, []);

  // ---- GSAP Flip: capture old positions BEFORE React re-render ----
  // During the render phase the DOM still reflects the previous commit.
  // This lets us snapshot old card positions before React applies the
  // new card list. We only capture when the cards actually changed.
  const cardsKey = cards.map((c) => c.id).join(",");
  if (cardsKey !== prevCardsKey.current && handRef.current) {
    flipStateRef.current = Flip.getState(".hcard", {
      props: "transform",
    });
  }
  prevCardsKey.current = cardsKey;

  // ---- Apply the Flip animation AFTER React commits the new DOM ----
  useLayoutEffect(() => {
    if (!handRef.current) return;
    const state = flipStateRef.current;
    flipStateRef.current = null;
    if (state) {
      Flip.from(state, {
        duration: 0.35,
        ease: easeOut,
        absolute: true,
        toggleClass: "flipping",
      });
    }
  }, [cards]);

  function handleCardClick(card: Card) {
    if (!isMyTurn) return;

    const legal = canPlay(card, topCard, activeColor);

    if (!legal) {
      // Shake the card
      const el = shakeTargets.current.get(card.id);
      if (el) {
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
      onToast?.({
        message: "Illegal move — card doesn't match",
        type: "error",
      });
      return;
    }

    // For all legal plays, call onPlayCard immediately.
    // The card will be removed from the hand when the server broadcasts the
    // updated game state, and GSAP Flip will reflow the remaining cards.
    hapticPlay();
    onPlayCard(card.id);
  }

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-[130px] text-[var(--ink-dim)] text-[14px]">
        No cards in hand
      </div>
    );
  }

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
            style={{
              marginLeft: idx === 0 ? "0" : "-16px",
              zIndex: idx,
              borderColor: isWild
                ? "rgba(255,255,255,0.4)"
                : "var(--card-border)",
              background: isWild
                ? "linear-gradient(135deg, #2b2f42, #33384f)"
                : cardGradient(card),
              transform: `rotate(${(idx - (cards.length - 1) / 2) * 2}deg)`,
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
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
