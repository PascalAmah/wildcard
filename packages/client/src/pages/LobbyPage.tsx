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

  // Navigate to the table when the server confirms game state for solo-vs-computer.
  // We gate on the GameStateProvider receiving game:state rather than the socket
  // ack callback, so navigation never races with the game state delivery.
  useEffect(() => {
    if (state.screen !== "playing" || navigatedRef.current) return;

    // If the solo form set a pending room, use that
    if (pendingSoloRoomRef.current) {
      const roomId = pendingSoloRoomRef.current;
      pendingSoloRoomRef.current = null;
      navigatedRef.current = true;
      navigate(`/table/${roomId}`);
      return;
    }

    // Fallback: if game:state arrived but the solo callback never fired
    // (e.g. socket disconnect during room:start ack), navigate to the
    // table using the roomId embedded in the game view.
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
      // If game:state already arrived, navigate right away
      if (state.screen === "playing") {
        pendingSoloRoomRef.current = null;
        navigate(`/table/${roomId}`);
      }
    },
    [navigate, state.screen],
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[920px]">
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
    </div>
  );
}
