import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import CreateTableForm from "../components/lobby/CreateTableForm";
import JoinTableForm from "../components/lobby/JoinTableForm";
import SoloVsComputerForm from "../components/lobby/SoloVsComputerForm";
import { useGameState } from "../hooks/useGameState";

interface RoomState {
  players: Array<{ id: string; name: string; isBot: boolean; isReady: boolean }>;
  hostId: string;
  maxPlayers: number;
  theme: string;
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { state } = useGameState();
  const pendingSoloRoomRef = useRef<string | null>(null);
  const navigatedRef = useRef(false);

  useEffect(() => {
    if (state.screen !== "playing" || navigatedRef.current) return;

    if (pendingSoloRoomRef.current) {
      const roomId = pendingSoloRoomRef.current;
      pendingSoloRoomRef.current = null;
      navigatedRef.current = true;
      navigate(`/table/${roomId}`);
      return;
    }

    const playingState = state as { screen: "playing"; view: { roomId: string } };
    if (playingState.view?.roomId) {
      navigatedRef.current = true;
      navigate(`/table/${playingState.view.roomId}`);
    }
  }, [state, navigate]);

  const handleCreated = useCallback(
    (roomId: string, roomState?: RoomState) => {
      navigate(`/table/${roomId}/waiting`, { state: { roomState } });
    },
    [navigate],
  );

  const handleJoined = useCallback(
    (roomId: string, roomState?: RoomState) => {
      navigate(`/table/${roomId}/waiting`, { state: { roomState } });
    },
    [navigate],
  );

  // Solo vs computer: the room is auto-created, bots added, and game started
  // before this fires. Instead of navigating immediately (which can race with
  // the socket delivering game:state), we store the roomId and let the
  // useEffect above navigate only once game:state confirms screen: "playing".
  const handleSoloStarted = useCallback(
    (roomId: string) => {
      pendingSoloRoomRef.current = roomId;
      if (state.screen === "playing") {
        pendingSoloRoomRef.current = null;
        navigate(`/table/${roomId}`);
      }
    },
    [navigate, state.screen],
  );

  return (
    <div className="h-full overflow-auto flex items-start justify-center p-6 relative">
      <div className="w-full max-w-[920px] pb-12">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-9">
          <div className="w-[14px] h-[14px] rounded-[4px] rotate-[8deg] bg-[conic-gradient(from_45deg,#34c77b,#f2b341,#ef5b68,#4c6ef5,#34c77b)]" />
          <span className="font-[Fredoka] font-bold text-[20px]">Wildcard</span>
        </div>

        {/* Three panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <CreateTableForm onCreated={handleCreated} />
          <JoinTableForm onJoined={handleJoined} />
          <SoloVsComputerForm onGameStarted={handleSoloStarted} />
        </div>
      </div>

      {/* Bottom fade + scroll hint (visible only when content overflows) */}
      <div
        className="fixed bottom-0 left-0 right-0 h-20 pointer-events-none md:hidden"
        style={{
          background: "linear-gradient(to top, var(--bg) 0%, transparent 100%)",
        }}
      />
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none md:hidden">
        <span className="text-[11px] text-[var(--ink-dim)]">scroll for more options</span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--ink-dim)" strokeWidth="2" strokeLinecap="round">
          <path d="M3 5l4 4 4-4" />
        </svg>
      </div>
    </div>
  );
}
