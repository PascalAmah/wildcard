import { useRef, useEffect } from "react";
import gsap from "gsap";
import type { CardColor } from "@wildcard/shared";

interface WildColorPickerProps {
  onChooseColor: (color: CardColor) => void;
}

const COLORS: Array<{
  color: CardColor;
  hex: string;
  hexDark: string;
}> = [
  { color: "green", hex: "#34c77b", hexDark: "#229a5f" },
  { color: "red", hex: "#ef5b68", hexDark: "#cf3b48" },
  { color: "yellow", hex: "#f2b341", hexDark: "#d5940f" },
  { color: "blue", hex: "#4c6ef5", hexDark: "#3450d1" },
];

export default function WildColorPicker({ onChooseColor }: WildColorPickerProps) {
  const scrimRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();

    // Scrim fade-in
    tl.fromTo(
      scrimRef.current,
      { opacity: 0 },
      { opacity: 1, duration: 0.2, ease: "power2.out" },
    );

    // Modal scale-in
    tl.fromTo(
      modalRef.current,
      { scale: 0.8, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(1.7)" },
      "-=0.1",
    );
  }, []);

  function handleChoose(color: CardColor) {
    // Quick exit animation
    const tl = gsap.timeline({
      onComplete: () => onChooseColor(color),
    });

    tl.to(modalRef.current, {
      scale: 0.85,
      opacity: 0,
      duration: 0.15,
      ease: "power2.in",
    });

    tl.to(
      scrimRef.current,
      { opacity: 0, duration: 0.15, ease: "power2.in" },
      "-=0.1",
    );
  }

  return (
    <div
      ref={scrimRef}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
    >
      <div
        ref={modalRef}
        className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-6 shadow-2xl"
      >
        <h2 className="text-[16px] font-bold font-[Fredoka] text-[var(--ink)] text-center mb-4">
          Choose a color
        </h2>

        <div className="flex gap-3">
          {COLORS.map(({ color, hex, hexDark }) => (
            <button
              key={color}
              className="w-16 h-16 rounded-2xl border-2 border-white/20 cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-95"
              style={{
                background: `linear-gradient(160deg, ${hex}, ${hexDark})`,
              }}
              onClick={() => handleChoose(color)}
              aria-label={`Choose ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
