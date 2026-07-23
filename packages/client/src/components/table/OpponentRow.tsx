interface Opponent {
  id: string;
  name: string;
  isBot: boolean;
  handCount: number;
}

interface OpponentRowProps {
  players: Opponent[];
  currentPlayerIndex: number;
  myPlayerId: string;
}

/** The index of the current player in the *full* players array is
 *  known from the `view.currentPlayerIndex` in ClientView.
 *  We filter out myPlayerId from the display but still need the
 *  original index to highlight the active turn. */
export default function OpponentRow({
  players,
  currentPlayerIndex,
  myPlayerId,
}: OpponentRowProps) {
  const opponents = players.filter((p) => p.id !== myPlayerId);
  const currentPlayerId = players[currentPlayerIndex]?.id;

  if (opponents.length === 0) {
    return (
      <div className="flex items-center justify-center h-[80px] text-[var(--ink-dim)] text-[14px]">
        Waiting for opponents…
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-none">
      <div className="flex items-center justify-center gap-4 min-w-min" style={{ gap: opponents.length > 4 ? '0.5rem' : '1.5rem' }}>
      {opponents.map((player) => {
        const isActive = player.id === currentPlayerId;
        return (
          <div
            key={player.id}
            className={`flex flex-col items-center transition-all duration-300 ${
              isActive
                ? "scale-105"
                : "opacity-70"
            }`}
          >
            {/* Avatar circle */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold font-[Fredoka] mb-1.5 ${
                isActive
                  ? "shadow-[0_0_12px_var(--accent)]"
                  : ""
              }`}
              style={{
                background: isActive
                  ? "var(--accent)"
                  : "var(--panel-2)",
                color: isActive ? "#fff" : "var(--ink-dim)",
                border: isActive
                  ? "2px solid var(--accent)"
                  : "2px solid var(--line)",
              }}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>

            {/* Name */}
            <span
              className={`text-[11px] font-semibold mb-1 ${
                isActive ? "text-[var(--ink)]" : "text-[var(--ink-dim)]"
              }`}
            >
              {player.name}
              {player.isBot && (
                <span className="ml-1 text-[10px] text-[var(--ink-dim)] opacity-60">
                  ●
                </span>
              )}
            </span>

            {/* Hand count as card-back icons */}
            <div className="flex items-center gap-[1px]">
              {Array.from(
                { length: Math.min(player.handCount, 7) },
                (_, i) => (
                  <div
                    key={i}
                    className="w-[10px] h-[14px] rounded-sm border"
                    style={{
                      borderColor: "var(--card-border)",
                      background:
                        "linear-gradient(135deg, #2b2f42, #33384f)",
                    }}
                  />
                ),
              )}
              {player.handCount > 7 && (
                <span className="text-[10px] text-[var(--ink-dim)] ml-0.5">
                  +{player.handCount - 7}
                </span>
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
