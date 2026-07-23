import { useState } from "react";
import { socket, persistRoomCode, persistPlayerId } from "../../lib/socketClient";
import Button from "../shared/Button";
import type { ErrorCode } from "@wildcard/shared";

type PlayerData = { id: string; name: string; isBot: boolean; isReady: boolean };

interface JoinTableFormProps {
  onJoined: (roomId: string, roomState: {
    players: PlayerData[];
    hostId: string;
    maxPlayers: number;
    theme: string;
  }) => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  ROOM_NOT_FOUND:
    "That table doesn't exist. Double-check the code with whoever sent it.",
  ROOM_FULL:
    "That table is full.",
  ROOM_IN_PROGRESS:
    "That table's game has already started — ask the host for a new one, or wait for the next round.",
};

export default function JoinTableForm({ onJoined }: JoinTableFormProps) {
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const isValid =
    playerName.trim().length > 0 && roomCode.trim().length === 4;

  function handleRoomCodeInput(value: string) {
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setRoomCode(upper);
    setError("");
  }

  async function handleJoin() {
    if (!isValid || joining) return;
    setJoining(true);
    setError("");

    socket.emit("room:join", { roomCode: roomCode.trim(), playerName: playerName.trim() }, (res: {
      success: boolean;
      roomId?: string;
      players?: PlayerData[];
      theme?: string;
      code?: ErrorCode;
      error?: string;
    }) => {
      if (res.success && res.roomId) {
        persistRoomCode(res.roomId);
        if (socket.id) {
          persistPlayerId(socket.id);
        }
        onJoined(res.roomId, {
          players: res.players ?? [],
          hostId: "",
          maxPlayers: 0,
          theme: res.theme ?? "midnight",
        });
      } else {
        const msg =
          (res.code && ERROR_MESSAGES[res.code]) ?? res.error ?? "Failed to join table";
        setError(msg);
        setJoining(false);
      }
    });
  }

  return (
    <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-[30px_26px] flex flex-col">
      <h2 className="font-[Fredoka] font-semibold text-[22px] mb-2">Join a table</h2>
      <p className="text-[14px] text-[var(--ink-dim)] leading-relaxed mb-[26px]">
        Got a code from a friend? Drop it in below and you're at the table.
      </p>

      <label className="text-[12.5px] font-bold text-[var(--ink-dim)] uppercase tracking-[0.05em] mb-2 block">
        Your name
      </label>
      <input
        type="text"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        placeholder="e.g. Maya"
        maxLength={16}
        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl p-[14px_16px] text-[16px] text-[var(--ink)] mb-[18px] outline-none focus:border-[#4c6ef5] placeholder:text-[#5a5c6b]"
      />

      <label className="text-[12.5px] font-bold text-[var(--ink-dim)] uppercase tracking-[0.05em] mb-2 block">
        Room code
      </label>
      <input
        type="text"
        value={roomCode}
        onChange={(e) => handleRoomCodeInput(e.target.value)}
        placeholder="7X4Q"
        maxLength={4}
        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl p-[14px_16px] font-[Fredoka] text-[22px] tracking-[0.28em] text-center text-[var(--ink)] mb-[18px] outline-none focus:border-[#4c6ef5] placeholder:text-[#5a5c6b]"
      />

      {/* Error box */}
      {error && (
        <div className="flex items-start gap-2.5 bg-[rgba(239,91,104,0.10)] border border-[rgba(239,91,104,0.3)] rounded-xl p-[12px_14px] mb-4 text-[13.5px] text-[#ff9aa3] leading-relaxed">
          <span className="text-[15px] shrink-0 mt-0.5">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <Button
        variant="secondary"
        size="lg"
        disabled={!isValid || joining}
        onClick={handleJoin}
        className="mt-auto"
      >
        {joining ? "Joining…" : "Join table →"}
      </Button>
    </div>
  );
}
