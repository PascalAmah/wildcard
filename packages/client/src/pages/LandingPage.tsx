import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-[14px] h-[14px] rounded-[4px] rotate-[8deg] bg-[conic-gradient(from_45deg,#34c77b,#f2b341,#ef5b68,#4c6ef5,#34c77b)]" />
        <span className="font-[Fredoka] font-bold text-[20px]">Wildcard</span>
      </div>

      <h1 className="font-[Fredoka] font-semibold text-[32px] mb-3 text-center">
        A fast color-and-number matching card game
      </h1>
      <p className="text-[var(--ink-dim)] text-[16px] max-w-md text-center leading-relaxed mb-10">
        For 2–10 players. No accounts, no downloads — just a room code and you're in.
      </p>

      <button
        onClick={() => navigate("/lobby")}
        className="border-none rounded-xl px-10 py-4 font-bold text-[16px] cursor-pointer bg-gradient-to-r from-[#ef5b68] to-[#d94655] text-white shadow-lg shadow-[rgba(239,91,104,0.28)] hover:-translate-y-0.5 hover:shadow-xl transition-all duration-180 ease-out"
      >
        Play now
      </button>
    </div>
  );
}
