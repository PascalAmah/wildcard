import type { ArenaTheme } from "@wildcard/shared";
import Button from "../shared/Button";

interface Player {
  id: string;
  name: string;
  isBot: boolean;
  isReady: boolean;
}

interface RosterListProps {
  players: Player[];
  maxPlayers: number;
  hostId: string;
  myPlayerId: string;
  isHost: boolean;
  onToggleReady: () => void;
  onAddBot: () => void;
  onRemoveBot: (botId: string) => void;
  onStart: () => void;
  theme: ArenaTheme;
}

const COLORS = ["#34c77b", "#ef5b68", "#f2b341", "#4c6ef5"];

function initials(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "?";
}

export default function RosterList({
  players,
  maxPlayers,
  hostId,
  myPlayerId,
  isHost,
  onToggleReady,
  onAddBot,
  onRemoveBot,
  onStart,
}: RosterListProps) {
  const me = players.find((p) => p.id === myPlayerId);
  const amIReady = me?.isReady ?? false;
  const notReadyCount = players.filter((p) => !p.isReady && !p.isBot).length;
  const canStart = isHost && notReadyCount === 0 && players.length >= 2;
  const emptySlots = maxPlayers - players.length;

  return (
    <div>
      {/* Roster list */}
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-2 mb-[22px]">
        {players.map((p, i) => {
          const isMe = p.id === myPlayerId;
          const isPlayerHost = p.id === hostId;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3.5 p-[14px_16px] rounded-xl transition-colors duration-200 ${
                isMe ? "bg-[rgba(76,110,245,0.08)]" : ""
              } ${p.isBot ? "" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-[Fredoka] font-semibold text-[15px] text-white ${
                  p.isBot
                    ? "bg-[var(--panel-2)] border-[1.5px] border-[var(--line)]"
                    : ""
                }`}
                style={
                  !p.isBot
                    ? { background: COLORS[i % COLORS.length] }
                    : undefined
                }
              >
                {p.isBot ? "🤖" : initials(p.name)}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="font-bold text-[14.5px] flex items-center gap-2">
                  {isMe ? "You" : p.name}
                  {isPlayerHost && (
                    <span className="text-[10px] font-bold text-[#f2b341] bg-[rgba(242,179,65,0.12)] border border-[rgba(242,179,65,0.3)] px-2 py-0.5 rounded-full uppercase tracking-[0.04em]">
                      Host
                    </span>
                  )}
                  {p.isBot && (
                    <span className="text-[10px] font-bold text-[var(--ink-dim)] bg-[var(--panel-2)] border border-[var(--line)] px-2 py-0.5 rounded-full uppercase tracking-[0.04em]">
                      Bot
                    </span>
                  )}
                </div>
                <div className="text-[12.5px] text-[var(--ink-dim)] mt-0.5">
                  {isMe
                    ? "That's you"
                    : p.isBot
                      ? "Fills a seat, plays automatically"
                      : "Joined the table"}
                </div>
              </div>

              {/* Right side */}
              {p.isBot && isHost ? (
                <button
                  onClick={() => onRemoveBot(p.id)}
                  className="text-[12px] text-[var(--ink-dim)] font-bold cursor-pointer px-2 py-1 hover:text-[#ef5b68] transition-colors"
                >
                  Remove
                </button>
              ) : (
                <div
                  className={`text-[12.5px] font-bold px-3.5 py-1.5 rounded-full ${
                    p.isReady
                      ? "bg-[rgba(52,199,123,0.14)] text-[#34c77b] border border-[rgba(52,199,123,0.4)]"
                      : "bg-[var(--bg)] text-[var(--ink-dim)] border border-[var(--line)]"
                  }`}
                >
                  {p.isReady ? "Ready" : "Not ready"}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty slots */}
        {Array.from({ length: emptySlots }, (_, i) => (
          <div
            key={`empty-${i}`}
            className={`flex items-center gap-3.5 p-[14px_16px] ${
              isHost
                ? "opacity-100 cursor-pointer hover:bg-[rgba(76,110,245,0.06)] transition-colors"
                : "opacity-40"
            }`}
            onClick={isHost ? onAddBot : undefined}
          >
            <div
              className={`w-10 h-10 rounded-full shrink-0 flex items-center justify-center font-[Fredoka] font-semibold text-[15px] bg-[var(--panel-2)] ${
                isHost
                  ? "border-[1.5px] border-solid border-[#4c6ef5] text-[#4c6ef5] font-bold text-base"
                  : "border-[1.5px] border-dashed border-[var(--line)]"
              }`}
            >
              {isHost ? "+" : ""}
            </div>
            <div className="text-[13px] text-[var(--ink-dim)]">
              {isHost
                ? "Add a bot to fill this seat"
                : "Waiting for a player to join…"}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3.5">
        <div className="text-[13.5px] text-[var(--ink-dim)]">
          <b className="text-[var(--ink)]">{players.length}</b> of{" "}
          <b className="text-[var(--ink)]">{maxPlayers}</b> joined
        </div>

        <div className="flex gap-3">
          <Button
            variant={amIReady ? "ready" : "tertiary"}
            size="md"
            onClick={onToggleReady}
            className={
              amIReady
                ? "!bg-[rgba(52,199,123,0.16)] !text-[#34c77b] !border-[rgba(52,199,123,0.45)]"
                : ""
            }
          >
            {amIReady ? "You're ready" : "I'm ready"}
          </Button>

          {isHost && (
            <Button
              variant="primary"
              size="md"
              disabled={!canStart}
              onClick={onStart}
            >
              Start game
            </Button>
          )}
        </div>
      </div>

      {/* Hint */}
      <div className="text-[12px] text-[var(--ink-dim)] text-center mt-3">
        {isHost && notReadyCount > 0
          ? `Waiting on ${notReadyCount} player${notReadyCount > 1 ? "s" : ""} to ready up`
          : isHost
            ? "Everyone's ready — start whenever you like"
            : notReadyCount > 0
              ? `Waiting on ${notReadyCount} player${notReadyCount > 1 ? "s" : ""} to ready up before ${
                  players.find((p) => p.id === hostId)?.name ?? "host"
                } (host) can start`
              : "Everyone's ready — waiting on the host to start"}
      </div>
    </div>
  );
}
