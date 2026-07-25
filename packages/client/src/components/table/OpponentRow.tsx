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

const AVATAR_COLORS = ["#34c77b", "#ef5b68", "#f2b341", "#4c6ef5"];

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
    <div className="overflow-x-auto pb-2 -mx-4 py-2 px-4 scrollbar-none">
      <div
        className="flex items-center justify-center min-w-min"
        style={{ gap: opponents.length > 4 ? "0.5rem" : "3.5rem" }}
      >
        {opponents.map((player, i) => {
          const isActive = player.id === currentPlayerId;
          const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div
              key={player.id}
              className={`flex flex-col items-center gap-2 transition-all duration-300 ${
                isActive ? "scale-105" : "opacity-70"
              }`}
            >
              {/* Avatar circle */}
              <div
                className={`w-[46px] h-[46px] rounded-full flex items-center justify-center font-[Fredoka] font-semibold text-[16px] transition-all duration-250 ${
                  isActive
                    ? "shadow-[0_0_0_4px_rgba(242,179,65,0.15)]"
                    : ""
                }`}
                style={{
                  background: avatarColor,
                  color: "#fff",
                  border: isActive
                    ? "2px solid var(--yellow)"
                    : "2px solid var(--line)",
                }}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>

              {/* Name */}
              <span
                className="text-[12.5px] font-semibold"
                style={{
                  color: isActive ? "var(--yellow)" : "var(--ink-dim)",
                }}
              >
                {player.name}
                {player.isBot && (
                  <span className="ml-1 text-[10px] opacity-60">●</span>
                )}
              </span>

              {/* Card-back icons */}
              <div className="flex">
                {Array.from(
                  { length: Math.min(player.handCount, 7) },
                  (_, j) => (
                    <div
                      key={j}
                      className="w-[20px] h-[28px] rounded-[4px] border-[1.5px]"
                      style={{
                        borderColor: "var(--line)",
                        marginLeft: j === 0 ? "0" : "-13px",
                        background:
                          "repeating-linear-gradient(135deg, #2b2f42, #2b2f42 4px, #33384f 4px, #33384f 8px)",
                      }}
                    />
                  ),
                )}
                {player.handCount > 7 && (
                  <span className="text-[10px] text-[var(--ink-dim)] ml-1 self-center">
                    +{player.handCount - 7}
                  </span>
                )}
              </div>

              {/* Card count text */}
              <span className="text-[11px] text-[var(--ink-dim)]">
                {player.handCount} card{player.handCount !== 1 ? "s" : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
