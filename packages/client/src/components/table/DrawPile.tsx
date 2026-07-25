import { forwardRef } from "react";

interface DrawPileProps {
  drawPileCount: number;
  onDraw: () => void;
  canDraw: boolean;
}

/**
 * Draw pile with stacked card backs and count label.
 * Forwards a ref to the top card element so Hand can use it as
 * the fly-from origin for draw animations.
 */
const DrawPile = forwardRef<HTMLDivElement, DrawPileProps>(
  function DrawPile({ drawPileCount, onDraw, canDraw }, ref) {
    function handleClick() {
      if (!canDraw) return;
      onDraw();
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

        {/* Top card back — exposed via ref for draw fly-from animation */}
        <div
          ref={ref}
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
        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[12px] font-semibold text-[var(--ink-dim)] whitespace-nowrap">
          Draw · {drawPileCount} left
        </span>
      </div>
    );
  },
);

export default DrawPile;
