import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GameStateProvider } from "./hooks/useGameState";
import { useSocket } from "./hooks/useSocket";
import LandingPage from "./pages/LandingPage";
import LobbyPage from "./pages/LobbyPage";
import WaitingRoomPage from "./pages/WaitingRoomPage";
import ConnectionLostOverlay from "./components/shared/ConnectionLostOverlay";
import "./styles/themes.css";

function AppShell() {
  const { state, attempt, maxAttemptsBeforeManual, manualRetry } = useSocket();

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/table/:roomId/waiting" element={<WaitingRoomPage />} />
        <Route path="/join/:roomCode" element={<LobbyPage />} />
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
