import { useState } from "react";
import { useNavigate } from "react-router-dom";

const RULES = [
  {
    title: "Objective",
    body: "Be the first player to empty your hand. When you play your last card, you win the round and score points based on the cards left in everyone else's hands.",
  },
  {
    title: "Play modes",
    body: "Create Table — you're the host, share the room code with friends. Join Table — enter a room code to hop into a friend's game. Play vs Computer — jump straight into a match against bots, no waiting needed.",
  },
  {
    title: "On your turn",
    body: "Play a card that matches the top card on the discard pile by color, number, or symbol. If you can't play, click the draw pile — a card is added to your hand and your turn passes.",
  },
  {
    title: "Action cards",
    body: "\u2298 Skip: the next player loses their turn. \u21C4 Reverse: reverses play direction. +2 Draw Two: the next player draws 2 cards and loses their turn.",
  },
  {
    title: "Wild cards",
    body: "\u2605 Wild: play it on any turn and pick a color. +4 Wild Draw Four: play it, pick a color, and the next player draws 4 cards and loses their turn.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);

  return (
    <div
      className={`h-full overflow-auto flex flex-col items-center px-6 relative ${showRules ? "justify-start pt-4 pb-8" : "justify-center"}`}
      style={{ background: "var(--bg)" }}
    >
      {/* Background glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-[-15%] left-[-20%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px]"
          style={{ background: "var(--bg-glow-1)" }}
        />
        <div
          className="absolute bottom-[-20%] right-[-15%] w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
          style={{ background: "var(--bg-glow-2)" }}
        />
        <div
          className="absolute top-[40%] left-[60%] w-[300px] h-[300px] rounded-full opacity-10 blur-[80px] animate-[pulseRing_4s_ease-in-out_infinite]"
          style={{ background: "var(--accent)" }}
        />
      </div>

      {/* Floating decorative cards */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-[12%] right-[8%] w-[55px] h-[78px] rounded-xl border-2 opacity-[0.06] rotate-12 hidden sm:block"
          style={{ borderColor: "var(--green)", background: "var(--green)", animation: "floatCard 6s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-[18%] left-[6%] w-[45px] h-[64px] rounded-xl border-2 opacity-[0.05] -rotate-6 hidden sm:block"
          style={{ borderColor: "var(--red)", background: "var(--red)", animation: "floatCard 7s ease-in-out 1s infinite" }}
        />
        <div
          className="absolute top-[30%] left-[12%] w-[40px] h-[56px] rounded-xl border-2 opacity-[0.04] rotate-[20deg] hidden sm:block"
          style={{ borderColor: "var(--blue)", background: "var(--blue)", animation: "floatCard 5.5s ease-in-out 2s infinite" }}
        />
        <div
          className="absolute bottom-[25%] right-[10%] w-[50px] h-[70px] rounded-xl border-2 opacity-[0.05] -rotate-[15deg] hidden sm:block"
          style={{ borderColor: "var(--yellow)", background: "var(--yellow)", animation: "floatCard 6.5s ease-in-out 0.5s infinite" }}
        />
      </div>

      {showRules ? (
        <div className="w-full max-w-lg mb-10">
          {/* Back above logo */}
          <button
            onClick={() => setShowRules(false)}
            className="flex items-center gap-1 text-[13px] text-[var(--ink-dim)] font-semibold bg-transparent border-none cursor-pointer mb-5"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
            Back
          </button>

          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-[14px] h-[14px] rounded-[4px] rotate-[8deg] bg-[conic-gradient(from_45deg,#34c77b,#f2b341,#ef5b68,#4c6ef5,#34c77b)]" />
            <span className="font-[Fredoka] font-bold text-[20px]" style={{ fontFamily: "'Fredoka', sans-serif" }}>Wildcard</span>
          </div>

          {/* How to play header */}
          <h2 className="font-[Fredoka] font-semibold text-[22px] mb-5 text-center" style={{ fontFamily: "'Fredoka', sans-serif" }}>How to play</h2>

          <div className="flex flex-col gap-4">
            {RULES.map((rule, i) => (
              <div
                key={i}
                className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-5"
              >
                <div className="font-[Fredoka] font-semibold text-[15px] mb-1.5" style={{ fontFamily: "'Fredoka', sans-serif" }}>{rule.title}</div>
                <p className="text-[14px] text-[var(--ink-dim)] leading-relaxed">{rule.body}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate("/lobby")}
            className="w-full mt-6 border-none rounded-xl px-10 py-4 font-bold text-[16px] cursor-pointer bg-gradient-to-r from-[#ef5b68] to-[#d94655] text-white shadow-lg shadow-[rgba(239,91,104,0.28)] hover:-translate-y-0.5 hover:shadow-xl transition-all duration-180 ease-out"
          >
            Play now
          </button>
        </div>
      ) : (
        <>
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-[14px] h-[14px] rounded-[4px] rotate-[8deg] bg-[conic-gradient(from_45deg,#34c77b,#f2b341,#ef5b68,#4c6ef5,#34c77b)]" />
            <span className="font-[Fredoka] font-bold text-[20px]" style={{ fontFamily: "'Fredoka', sans-serif" }}>Wildcard</span>
          </div>

          <h1 className="font-[Fredoka] font-semibold text-[32px] mb-3 text-center" style={{ fontFamily: "'Fredoka', sans-serif" }}>
            A fast color-and-number matching card game
          </h1>
          <p className="text-[var(--ink-dim)] text-[16px] max-w-md text-center leading-relaxed mb-10">
            For 2–10 players. No accounts, no downloads — just a room code and you're in.
          </p>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => navigate("/lobby")}
              className="border-none rounded-xl px-10 py-4 font-bold text-[16px] cursor-pointer bg-gradient-to-r from-[#ef5b68] to-[#d94655] text-white shadow-lg shadow-[rgba(239,91,104,0.28)] hover:-translate-y-0.5 hover:shadow-xl transition-all duration-180 ease-out"
            >
              Play now
            </button>
            <button
              onClick={() => setShowRules(true)}
              className="text-[13px] text-[var(--ink-dim)] font-semibold bg-transparent border-none cursor-pointer underline mt-1"
            >
              How to play
            </button>
          </div>
        </>
      )}
    </div>
  );
}
