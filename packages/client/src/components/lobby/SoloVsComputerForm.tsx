import { useState, useCallback } from "react";
import { socket } from "../../lib/socketClient";
import Button from "../shared/Button";

const BOT_COLORS = ["#34c77b", "#f2b341", "#ef5b68", "#4c6ef5", "#9a9caa"];

interface SoloVsComputerFormProps {
  onCreated: (roomId: string) => void;
}

export default function SoloVsComputerForm({ onCreated }: SoloVsComputerFormProps) {
  const [botCount, setBotCount] = useState(3);
  const [starting, setStarting] = useState(false);

  async function handleStartSolo() {
    if (starting) return;
    setStarting(true);

    // Step 1: Create a room with host "You"
    socket.emit(
      "room:create",
      { hostName: "You", maxPlayers: botCount + 1, theme: "midnight" },
      (createRes: { success: boolean; roomId?: string; error?: string }) => {
        if (!createRes.success || !createRes.roomId) {
          setStarting(false);
          return;
        }

        const roomId = createRes.roomId;

        // Step 2: Add bots one by one
        const botNames = Array.from(
          { length: botCount },
          (_, i) => `Bot ${i + 1}`,
        );

        let added = 0;
        for (const botName of botNames) {
          socket.emit(
            "room:addBot",
            { name: botName },
            () => {
              added++;
              if (added === botCount) {
                // Step 3: Auto-start the game
                socket.emit("room:start", {}, (startRes: { success: boolean }) => {
                  if (startRes.success) {
                    onCreated(roomId);
                  } else {
                    setStarting(false);
                  }
                });
              }
            },
          );
        }
      },
    );
  }

  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-[30px_26px] flex flex-col">
      <div className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-[#34c77b] bg-[rgba(52,199,123,0.12)] border border-[rgba(52,199,123,0.3)] px-2.5 py-1 rounded-full uppercase tracking-[0.04em] mb-3.5 w-fit">
        ⚡ Instant · no waiting room
      </div>

      <h2 className="font-[Fredoka] font-semibold text-[22px] mb-2">Play vs computer</h2>
      <p className="text-[14px] text-[var(--ink-dim)] leading-relaxed mb-[26px]">
        Just want to try the game? Jump straight in against bots — no code, no waiting on anyone.
      </p>

      <label className="text-[12.5px] font-bold text-[var(--ink-dim)] uppercase tracking-[0.05em] mb-2 block">
        Opponents
      </label>

      {/* Bot avatars */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="flex">
          {Array.from({ length: botCount }, (_, i) => (
            <span
              key={i}
              className="w-[26px] h-[26px] rounded-full border-2 border-[var(--panel)] -ml-[9px] first:ml-0 flex items-center justify-center text-[11px]"
              style={{ background: BOT_COLORS[i % BOT_COLORS.length] }}
            >
              🤖
            </span>
          ))}
        </div>
        <span className="text-[13.5px] text-[var(--ink-dim)]">
          {botCount} bot{botCount !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Bot count stepper */}
      <div className="flex items-center gap-4 mb-[22px] bg-[var(--bg)] border border-[var(--line)] rounded-xl p-[10px_16px] w-fit">
        <button
          type="button"
          onClick={() => setBotCount((b) => Math.max(1, b - 1))}
          className="w-[28px] h-[28px] rounded-lg border border-[var(--line)] bg-[var(--panel-2)] text-[var(--ink)] text-base font-bold flex items-center justify-center cursor-pointer hover:border-[#4c6ef5] transition-colors duration-200"
        >
          −
        </button>
        <div className="font-[Fredoka] font-semibold text-[18px] w-[24px] text-center">
          {botCount}
        </div>
        <button
          type="button"
          onClick={() => setBotCount((b) => Math.min(9, b + 1))}
          className="w-[28px] h-[28px] rounded-lg border border-[var(--line)] bg-[var(--panel-2)] text-[var(--ink)] text-base font-bold flex items-center justify-center cursor-pointer hover:border-[#4c6ef5] transition-colors duration-200"
        >
          +
        </button>
      </div>

      <Button
        variant="tertiary"
        size="lg"
        disabled={starting}
        onClick={handleStartSolo}
        className="mt-auto"
      >
        {starting ? "Dealing you in…" : "Play now →"}
      </Button>
    </div>
  );
}
