import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";

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
  const pageRef = useRef<HTMLDivElement>(null);

  // Staggered entrance animation on mount
  useEffect(() => {
    if (!pageRef.current || showRules) return;
    const items = pageRef.current.querySelectorAll(".landing-animate");
    gsap.fromTo(
      items,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, stagger: 0.12, ease: "power2.out" },
    );
  }, [showRules]);

  return (
    <div
      ref={pageRef}
      className={`h-full overflow-auto flex flex-col items-center px-6 ${showRules ? "justify-start pt-4 pb-8" : "justify-center"}`}
      style={{
        background: "radial-gradient(ellipse 600px 400px at 50% 30%, rgba(76,110,245,0.06) 0%, transparent 70%), radial-gradient(ellipse 800px 300px at 50% 80%, rgba(52,199,123,0.04) 0%, transparent 70%), var(--bg)",
      }}
    >
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
          <div className="flex items-center gap-2.5 mb-8 landing-animate">
            <div
              className="w-[14px] h-[14px] rounded-[4px] bg-[conic-gradient(from_45deg,#34c77b,#f2b341,#ef5b68,#4c6ef5,#34c77b)]"
              style={{ animation: "logoSpin 8s linear infinite" }}
            />
            <span className="font-[Fredoka] font-bold text-[20px]" style={{ fontFamily: "'Fredoka', sans-serif" }}>Wildcard</span>
          </div>

          <h1 className="font-[Fredoka] font-semibold text-[32px] mb-3 text-center landing-animate" style={{ fontFamily: "'Fredoka', sans-serif" }}>
            A fast color-and-number matching card game
          </h1>
          <p className="text-[var(--ink-dim)] text-[16px] max-w-md text-center leading-relaxed mb-10 landing-animate">
            For 2–10 players. No accounts, no downloads — just a room code and you're in.
          </p>

          <div className="flex flex-col items-center gap-3 landing-animate">
            <button
              onClick={() => navigate("/lobby")}
              className="border-none rounded-xl px-10 py-4 font-bold text-[16px] cursor-pointer bg-gradient-to-r from-[#ef5b68] to-[#d94655] text-white shadow-lg shadow-[rgba(239,91,104,0.28)] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[rgba(239,91,104,0.45)] active:translate-y-0 transition-all duration-200 ease-out"
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
