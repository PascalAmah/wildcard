import type { ArenaTheme } from "@wildcard/shared";

interface ArenaPickerProps {
  currentTheme: ArenaTheme;
  isHost: boolean;
  onThemeChange?: (theme: ArenaTheme) => void;
}

const ARENAS: { theme: ArenaTheme; label: string; gradient: string }[] = [
  { theme: "midnight", label: "Midnight", gradient: "linear-gradient(135deg,#17181d,#212330)" },
  { theme: "neon", label: "Neon Arcade", gradient: "linear-gradient(135deg,#0b0713,#2a1440)" },
  { theme: "sunset", label: "Sunset Lounge", gradient: "linear-gradient(135deg,#241412,#4a271c)" },
  { theme: "forest", label: "Forest Felt", gradient: "linear-gradient(135deg,#0f1f18,#1c3a2c)" },
];

const ARENA_LABELS: Record<ArenaTheme, string> = {
  midnight: "Midnight",
  neon: "Neon Arcade",
  sunset: "Sunset Lounge",
  forest: "Forest Felt",
};

export default function ArenaPicker({
  currentTheme,
  isHost,
  onThemeChange,
}: ArenaPickerProps) {
  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-[18px_24px] mb-[22px] flex items-center justify-between flex-wrap gap-3">
      <div>
        <div className="text-[12px] font-bold text-[var(--ink-dim)] uppercase tracking-[0.06em] mb-1.5">
          Arena
        </div>
        <div className="font-[Fredoka] font-semibold text-[15px]">
          {ARENA_LABELS[currentTheme]}
        </div>
      </div>

      {isHost ? (
        <div className="flex items-center gap-2">
          {ARENAS.map((a) => (
            <button
              key={a.theme}
              type="button"
              onClick={() => onThemeChange?.(a.theme)}
              className={`w-[28px] h-[28px] rounded-lg border-2 cursor-pointer p-0 transition-all duration-200 hover:-translate-y-0.5 ${
                currentTheme === a.theme ? "border-[#4c6ef5]" : "border-[var(--line)]"
              }`}
              style={{ background: a.gradient }}
              title={a.label}
            />
          ))}
        </div>
      ) : (
        <div className="text-[12px] text-[var(--ink-dim)]">
          Only the host can change this
        </div>
      )}
    </div>
  );
}
