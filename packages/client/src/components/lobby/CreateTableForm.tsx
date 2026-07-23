import { useState } from "react";
import { socket, persistRoomCode, persistPlayerId } from "../../lib/socketClient";
import type { ArenaTheme } from "@wildcard/shared";
import Button from "../shared/Button";

type PlayerData = { id: string; name: string; isBot: boolean; isReady: boolean };

interface CreateTableFormProps {
  onCreated: (roomId: string, roomState: {
    players: PlayerData[];
    hostId: string;
    maxPlayers: number;
    theme: ArenaTheme;
  }) => void;
}

const ARENAS: { theme: ArenaTheme; label: string; gradient: string }[] = [
  { theme: "midnight", label: "Midnight", gradient: "linear-gradient(135deg,#17181d,#212330)" },
  { theme: "neon", label: "Neon Arcade", gradient: "linear-gradient(135deg,#0b0713,#2a1440)" },
  { theme: "sunset", label: "Sunset Lounge", gradient: "linear-gradient(135deg,#241412,#4a271c)" },
  { theme: "forest", label: "Forest Felt", gradient: "linear-gradient(135deg,#0f1f18,#1c3a2c)" },
];

export default function CreateTableForm({ onCreated }: CreateTableFormProps) {
  const [hostName, setHostName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [selectedArena, setSelectedArena] = useState<ArenaTheme>("midnight");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const isValid = hostName.trim().length > 0;

  async function handleCreate() {
    if (!isValid || creating) return;
    setCreating(true);
    setError("");

    socket.emit("room:create", { hostName: hostName.trim(), maxPlayers, theme: selectedArena }, (res: {
      success: boolean;
      roomId?: string;
      players?: PlayerData[];
      error?: string;
    }) => {
      if (res.success && res.roomId) {
        persistRoomCode(res.roomId);
        // Store the player ID for reconnection
        if (socket.id) {
          persistPlayerId(socket.id);
        }
        onCreated(res.roomId, {
          players: res.players ?? [{
            id: socket.id ?? "",
            name: hostName.trim(),
            isBot: false,
            isReady: false,
          }],
          hostId: socket.id ?? "",
          maxPlayers,
          theme: selectedArena,
        });
      } else {
        setError(res.error ?? "Failed to create table");
        setCreating(false);
      }
    });
  }

  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-[30px_26px] flex flex-col">
      {/* Color chips */}
      <div className="flex gap-2.5 mb-6">
        <div className="w-[22px] h-[22px] rounded-lg bg-[#34c77b]" />
        <div className="w-[22px] h-[22px] rounded-lg bg-[#f2b341]" />
        <div className="w-[22px] h-[22px] rounded-lg bg-[#ef5b68]" />
        <div className="w-[22px] h-[22px] rounded-lg bg-[#4c6ef5]" />
      </div>

      <h2 className="font-[Fredoka] font-semibold text-[22px] mb-2">Start a table</h2>
      <p className="text-[14px] text-[var(--ink-dim)] leading-relaxed mb-[26px]">
        You'll get a room code to share. Everyone else joins with it — no accounts, no downloads.
      </p>

      {/* Name field */}
      <label className="text-[12.5px] font-bold text-[var(--ink-dim)] uppercase tracking-[0.05em] mb-2 block">
        Your name
      </label>
      <input
        type="text"
        value={hostName}
        onChange={(e) => setHostName(e.target.value)}
        placeholder="e.g. Dre"
        maxLength={16}
        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl p-[14px_16px] text-[16px] text-[var(--ink)] mb-[18px] outline-none focus:border-[#4c6ef5] placeholder:text-[#5a5c6b]"
      />

      {/* Max players stepper */}
      <label className="text-[12.5px] font-bold text-[var(--ink-dim)] uppercase tracking-[0.05em] mb-2 block">
        Max players
      </label>
      <div className="flex items-center gap-4 mb-[22px] bg-[var(--bg)] border border-[var(--line)] rounded-xl p-[10px_16px] w-fit">
        <button
          type="button"
          onClick={() => setMaxPlayers((p) => Math.max(2, p - 1))}
          className="w-[28px] h-[28px] rounded-lg border border-[var(--line)] bg-[var(--panel-2)] text-[var(--ink)] text-base font-bold flex items-center justify-center cursor-pointer hover:border-[#4c6ef5] transition-colors duration-200"
        >
          −
        </button>
        <div className="font-[Fredoka] font-semibold text-[18px] w-[24px] text-center">
          {maxPlayers}
        </div>
        <button
          type="button"
          onClick={() => setMaxPlayers((p) => Math.min(10, p + 1))}
          className="w-[28px] h-[28px] rounded-lg border border-[var(--line)] bg-[var(--panel-2)] text-[var(--ink)] text-base font-bold flex items-center justify-center cursor-pointer hover:border-[#4c6ef5] transition-colors duration-200"
        >
          +
        </button>
      </div>

      {/* Arena picker */}
      <label className="text-[12.5px] font-bold text-[var(--ink-dim)] uppercase tracking-[0.05em] mb-2 block">
        Arena
      </label>
      <div className="flex items-center gap-2 mb-[22px]">
        {ARENAS.map((a) => (
          <button
            key={a.theme}
            type="button"
            onClick={() => setSelectedArena(a.theme)}
            className={`w-[30px] h-[30px] rounded-lg border-2 cursor-pointer p-0 transition-all duration-200 hover:-translate-y-0.5 ${
              selectedArena === a.theme ? "border-[#4c6ef5]" : "border-[var(--line)]"
            }`}
            style={{ background: a.gradient }}
            title={a.label}
          />
        ))}
        <span className="text-[12.5px] text-[var(--ink-dim)] font-semibold ml-1">
          {ARENAS.find((a) => a.theme === selectedArena)?.label}
        </span>
      </div>

      {error && (
        <div className="text-[13px] text-[#ef5b68] mb-3">{error}</div>
      )}

      <Button
        variant="primary"
        size="lg"
        disabled={!isValid || creating}
        onClick={handleCreate}
        className="mt-auto"
      >
        {creating ? "Creating…" : "Create table →"}
      </Button>
    </div>
  );
}
