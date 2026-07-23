import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import CreateTableForm from "../components/lobby/CreateTableForm";
import JoinTableForm from "../components/lobby/JoinTableForm";
import SoloVsComputerForm from "../components/lobby/SoloVsComputerForm";

export default function LobbyPage() {
  const navigate = useNavigate();

  const handleCreated = useCallback(
    (roomId: string) => {
      navigate(`/table/${roomId}/waiting`);
    },
    [navigate],
  );

  const handleJoined = useCallback(
    (roomId: string) => {
      navigate(`/table/${roomId}/waiting`);
    },
    [navigate],
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
          <SoloVsComputerForm onCreated={handleCreated} />
        </div>
      </div>
    </div>
  );
}
