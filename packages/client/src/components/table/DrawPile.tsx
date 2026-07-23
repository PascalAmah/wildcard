import { useRef } from "react";
import gsap from "gsap";
import { isReducedMotion } from "../../lib/gsapConfig";

interface DrawPileProps {
  drawPileCount: number;
  onDraw: () => void;
  canDraw: boolean;
}

export default function DrawPile({ drawPileCount, onDraw, canDraw }: DrawPileProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  function handleClick() {
    if (!canDraw) return;

    // Brief scale-down tween on press (skip if reduced-motion)
    if (cardRef.current && !isReducedMotion()) {
      gsap.fromTo(
        cardRef.current,
        { scale: 1 },
        {
          scale: 0.92,
          duration: 0.1,
          yoyo: true,
          ease: "power2.in",
          onComplete: onDraw,
        },
      );
    } else {
      onDraw();
    }
  }

  return (
    <div
      className="relative flex items-center justify-center w-[84px] h-[122px] cursor-pointer select-none"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={`Draw pile: ${drawPileCount} cards remaining`}
    >
      {/* Stacked card backs */}
      {drawPileCount > 0 && (
        <>
          <div
            className="absolute w-full h-full rounded-xl border-2"
            style={{
              borderColor: "var(--card-border)",
              background: "linear-gradient(135deg, #2b2f42, #33384f)",
              transform: "rotate(3deg) translate(2px, -1px)",
            }}
          />
          <div
            className="absolute w-full h-full rounded-xl border-2"
            style={{
              borderColor: "var(--card-border)",
              background: "linear-gradient(135deg, #2b2f42, #33384f)",
              transform: "rotate(-2deg) translate(-1px, 1px)",
            }}
          />
        </>
      )}

      {/* Top card back */}
      <div
        ref={cardRef}
        className="relative w-full h-full rounded-xl border-2 flex items-center justify-center"
        style={{
          borderColor: "var(--card-border)",
          background: "linear-gradient(135deg, #2b2f42, #33384f)",
        }}
      >
        <svg width="32" height="32" viewBox="0 0 32 32" className="opacity-30">
          <polygon
            points="16,4 28,16 16,28 4,16"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Count label */}
      {drawPileCount > 0 && (
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-[var(--ink-dim)] whitespace-nowrap">
          {drawPileCount}
        </span>
      )}
    </div>
  );
}
