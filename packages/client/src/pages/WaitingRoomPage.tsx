import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../lib/socketClient";
import type { ArenaTheme } from "@wildcard/shared";
import RosterList from "../components/waitingroom/RosterList";
import ArenaPicker from "../components/waitingroom/ArenaPicker";

interface Player {
  id: string;
  name: string;
  isBot: boolean;
  isReady: boolean;
}

interface RoomState {
  players: Player[];
  hostId: string;
  maxPlayers: number;
  theme: ArenaTheme;
}

export default function WaitingRoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [copied, setCopied] = useState(false);
  const [myPlayerId] = useState(socket.id ?? "");

  useEffect(() => {
    if (!roomId) return;

    // Listen for room state updates
    function onRoomState(data: {
      players: Player[];
      hostId: string;
      maxPlayers: number;
      theme: ArenaTheme;
    }) {
      setRoomState(data);
    }

    // Listen for game start (redirect to table)
    function onGameState() {
      navigate(`/table/${roomId}`);
    }

    socket.on("room:state", onRoomState);
    socket.on("game:state", onGameState);

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("game:state", onGameState);
    };
  }, [roomId, navigate]);

  const isHost = roomState ? socket.id === roomState.hostId : false;

  const handleToggleReady = useCallback(() => {
    const me = roomState?.players.find((p) => p.id === socket.id);
    if (me) {
      socket.emit("player:ready", { ready: !me.isReady });
    }
  }, [roomState]);

  const handleAddBot = useCallback(() => {
    socket.emit("room:addBot", {});
  }, []);

  const handleRemoveBot = useCallback((botId: string) => {
    socket.emit("room:removeBot", { botId });
  }, []);

  const handleStart = useCallback(() => {
    socket.emit("room:start", {});
  }, []);

  const handleThemeChange = useCallback(
    (theme: ArenaTheme) => {
      socket.emit("room:setTheme", { roomId, theme });
    },
    [roomId],
  );

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/join/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, [roomId]);

  if (!roomState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--ink-dim)] text-[14px]">Loading room…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[560px]">
        {/* Room code panel */}
        <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-[26px_30px] flex items-center justify-between mb-4">
          <div>
            <div className="text-[12px] font-bold text-[var(--ink-dim)] uppercase tracking-[0.06em] mb-1.5">
              Room code
            </div>
            <div className="font-[Fredoka] font-bold text-[30px] tracking-[0.1em]">
              {roomId}
            </div>
          </div>
          <button
            onClick={handleCopyLink}
            className={`px-4 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
              copied
                ? "bg-transparent border-[#34c77b] text-[#34c77b]"
                : "bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[#4c6ef5]"
            }`}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        {/* Arena picker */}
        <ArenaPicker
          currentTheme={roomState.theme}
          isHost={isHost}
          onThemeChange={handleThemeChange}
        />

        {/* Title */}
        <h1 className="font-[Fredoka] font-semibold text-[22px] mb-1">
          Waiting for everyone to get in
        </h1>
        <p className="text-[14px] text-[var(--ink-dim)] mb-[22px]">
          2–{roomState.maxPlayers} players · game starts once the host hits start
        </p>

        {/* Roster */}
        <RosterList
          players={roomState.players}
          maxPlayers={roomState.maxPlayers}
          hostId={roomState.hostId}
          myPlayerId={myPlayerId || socket.id || ""}
          isHost={isHost}
          onToggleReady={handleToggleReady}
          onAddBot={handleAddBot}
          onRemoveBot={handleRemoveBot}
          onStart={handleStart}
          theme={roomState.theme}
        />
      </div>
    </div>
  );
}
