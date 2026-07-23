import { useRef, useEffect } from "react";
import gsap from "gsap";
import type { Card, CardColor } from "@wildcard/shared";

// ---------- helpers ----------

const colorHex: Record<CardColor, { light: string; dark: string }> = {
  green: { light: "#34c77b", dark: "#229a5f" },
  red: { light: "#ef5b68", dark: "#cf3b48" },
  yellow: { light: "#f2b341", dark: "#d5940f" },
  blue: { light: "#4c6ef5", dark: "#3450d1" },
};

function cardLabel(card: Card): string {
  if (card.type === "NUMBER") return String(card.value ?? "");
  if (card.type === "SKIP") return "\u2298"; // ⊘
  if (card.type === "REVERSE") return "\u21C4"; // ⇄
  if (card.type === "DRAW_TWO") return "+2";
  if (card.type === "WILD") return "\u2605"; // ★
  if (card.type === "WILD_DRAW_FOUR") return "+4";
  return "";
}

/** Background gradient string for non-wild cards. */
function cardGradient(card: Card): string {
  if (!card.color) return "transparent";
  const c = colorHex[card.color];
  return `linear-gradient(160deg, ${c.light}, ${c.dark})`;
}

// ---------- component ----------

interface DiscardPileProps {
  topCard: Card | null;
  activeColor: CardColor;
}

export default function DiscardPile({ topCard, activeColor }: DiscardPileProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const prevCardId = useRef<string | null>(null);

  // Pulse the card when it changes
  useEffect(() => {
    if (!cardRef.current) return;
    if (!topCard) return;
    if (prevCardId.current === topCard.id) return;
    prevCardId.current = topCard.id;

    gsap.fromTo(
      cardRef.current,
      { scale: 1 },
      {
        scale: 1.08,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
      },
    );
  }, [topCard]);

  if (!topCard) {
    return (
      <div className="relative flex items-center justify-center w-[84px] h-[122px]">
        <div className="w-full h-full rounded-xl border-2 border-dashed border-[var(--line)]" />
      </div>
    );
  }

  const isWild = topCard.type === "WILD" || topCard.type === "WILD_DRAW_FOUR";

  return (
    <div className="relative flex items-center justify-center w-[84px] h-[122px]">
      {/* Active-color ring glow */}
      <div
        className="absolute w-[110px] h-[110px] rounded-full opacity-30 blur-xl"
        style={{ backgroundColor: colorHex[activeColor].light }}
      />

      {/* Card */}
      <div
        ref={cardRef}
        className="relative w-full h-full rounded-xl border-2 flex flex-col items-center justify-center select-none"
        style={{
          borderColor: isWild ? "rgba(255,255,255,0.4)" : "var(--card-border)",
          background: isWild
            ? "linear-gradient(135deg, #2b2f42, #33384f)"
            : cardGradient(topCard),
        }}
      >
        {/* Center label */}
        <span
          className="font-[Fredoka] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          style={{ fontSize: isWild ? "22px" : "26px" }}
        >
          {cardLabel(topCard)}
        </span>

        {/* Corner badge — top-left */}
        <span
          className="absolute top-1.5 left-2 text-[10px] font-[Fredoka] font-bold text-white/90 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
        >
          {cardLabel(topCard)}
        </span>

        {isWild && (
          <span
            className="absolute bottom-1.5 right-2 text-[10px] font-[Fredoka] font-bold text-white/60"
          >
            ★
          </span>
        )}
      </div>
    </div>
  );
}
