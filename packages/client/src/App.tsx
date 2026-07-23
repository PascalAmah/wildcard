import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GameStateProvider } from "./hooks/useGameState";
import { useSocket } from "./hooks/useSocket";
import { socket, getStoredRoomCode, getStoredPlayerId } from "./lib/socketClient";
import LandingPage from "./pages/LandingPage";
import LobbyPage from "./pages/LobbyPage";
import WaitingRoomPage from "./pages/WaitingRoomPage";
import TablePage from "./pages/TablePage";
import ScoreboardPage from "./pages/ScoreboardPage";
import ConnectionLostOverlay from "./components/shared/ConnectionLostOverlay";
import "./styles/themes.css";

function AppShell() {
  const { state, attempt, maxAttemptsBeforeManual, manualRetry } = useSocket();

  // On socket (re)connect, rejoin the room if we have a stored room code.
  // This is critical because socket reconnection gives the server a new socket
  // identity, and the server's emitToPlayer() won't find us without fresh socket.data.
  useEffect(() => {
    function onConnect() {
      const roomCode = getStoredRoomCode();
      const playerId = getStoredPlayerId() || socket.id;
      if (roomCode && playerId) {
        socket.emit("room:rejoin", { roomCode, playerId });
      }
    }

    socket.on("connect", onConnect);
    return () => {
      socket.off("connect", onConnect);
    };
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/table/:roomId/waiting" element={<WaitingRoomPage />} />
        <Route path="/join/:roomCode" element={<LobbyPage />} />
        <Route path="/table/:roomId" element={<TablePage />} />
        <Route path="/table/:roomId/results" element={<ScoreboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <ConnectionLostOverlay
        state={state}
        attempt={attempt}
        maxAttemptsBeforeManual={maxAttemptsBeforeManual}
        onManualRetry={manualRetry}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GameStateProvider>
        <AppShell />
      </GameStateProvider>
    </BrowserRouter>
  );
}
