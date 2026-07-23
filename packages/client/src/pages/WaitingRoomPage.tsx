import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  const location = useLocation();

  const [roomState, setRoomState] = useState<RoomState | null>(
    (location.state as { roomState?: RoomState })?.roomState ?? null,
  );
  const [copied, setCopied] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;
    navigatedRef.current = false;

    function onRoomState(data: {
      players: Player[];
      hostId: string;
      maxPlayers: number;
      theme: ArenaTheme;
    }) {
      if (!navigatedRef.current) {
        setRoomState(data);
      }
    }

    function onGameState() {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      navigate(`/table/${roomId}`);
    }

    socket.on("room:state", onRoomState);
    socket.on("game:state", onGameState);

    // Request current room state from the server.
    // This covers page refreshes and the race where the
    // initial broadcast arrives before the listener was set up.
    socket.emit("room:requestState");

    return () => {
      socket.off("room:state", onRoomState);
      socket.off("game:state", onGameState);
    };
  }, [roomId, navigate]);

  // Sync the room's arena theme to <body> so CSS variables take effect
  useEffect(() => {
    if (roomState?.theme) {
      document.body.dataset.theme = roomState.theme;
    }
  }, [roomState?.theme]);

  // Set default theme on mount
  useEffect(() => {
    if (!document.body.dataset.theme) {
      document.body.dataset.theme = "midnight";
    }
  }, []);

  const [myPlayerId, setMyPlayerId] = useState(socket.id ?? "");
  useEffect(() => {
    function onConnect() {
      setMyPlayerId(socket.id ?? "");
    }
    socket.on("connect", onConnect);
    // If already connected, use the current id
    if (socket.connected && socket.id) {
      setMyPlayerId(socket.id);
    }
    return () => {
      socket.off("connect", onConnect);
    };
  }, []);

  const isHost = roomState ? myPlayerId === roomState.hostId : false;

  function handleToggleReady() {
    if (!roomState) return;
    const pid = myPlayerId || socket.id;
    if (!pid) return;
    const me = roomState.players.find((p) => p.id === pid);
    if (me) {
      socket.emit("player:ready", { ready: !me.isReady });
    }
  }

  function handleAddBot() {
    socket.emit("room:addBot", {});
  }

  function handleRemoveBot(botId: string) {
    socket.emit("room:removeBot", { botId });
  }

  function handleStart() {
    socket.emit("room:start", {});
  }

  function handleThemeChange(theme: ArenaTheme) {
    socket.emit("room:setTheme", { roomId, theme });
  }

  function handleCopyCode() {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

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
            onClick={handleCopyCode}
            className={`px-4 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer border transition-colors duration-200 ${
              copied
                ? "bg-transparent border-[#34c77b] text-[#34c77b]"
                : "bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[#4c6ef5]"
            }`}
          >
            {copied ? "Copied!" : "Copy code"}
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
