interface ReconnectOverlayProps {
  disconnectedPlayerId: string | null;
  disconnectedPlayerName: string;
  countdown: number; // seconds remaining (0–60)
  isMe: boolean;
  onRetry?: () => void;
  onPlayWithout?: () => void;
}

export default function ReconnectOverlay({
  disconnectedPlayerId,
  disconnectedPlayerName,
  countdown,
  isMe,
  onRetry,
  onPlayWithout,
}: ReconnectOverlayProps) {
  if (!disconnectedPlayerId) return null;

  const percentage = Math.max(0, Math.min(100, (countdown / 60) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-8 max-w-[380px] w-full shadow-2xl text-center">
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-[rgba(239,91,104,0.14)] flex items-center justify-center mx-auto mb-4">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef5b68"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 3.11A10 10 0 0 1 21.5 8" />
            <path d="M5 8a10 10 0 0 1 2.82-4.64" />
            <path d="M8.53 18.26a10 10 0 0 1 6.94 0" />
            <path d="M12 22h.01" />
            <path d="M22 12c0 5.52-4.48 10-10 10" />
            <path d="M2 12c0-5.52 4.48-10 10-10" />
          </svg>
        </div>

        {isMe ? (
          <>
            <h2 className="text-[18px] font-bold font-[Fredoka] text-[var(--ink)] mb-2">
              You've been disconnected
            </h2>
            <p className="text-[13px] text-[var(--ink-dim)] mb-5">
              Don't worry — your spot is saved. Try reconnecting.
            </p>

            <button
              onClick={onRetry}
              className="w-full py-3 rounded-xl text-[14px] font-bold cursor-pointer bg-[#4c6ef5] text-white hover:bg-[#3b5bdb] transition-colors duration-200 border-none mb-4"
            >
              Retry now
            </button>

            {/* Countdown bar */}
            <div className="w-full h-2 rounded-full bg-[var(--panel-2)] overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                style={{
                  width: `${percentage}%`,
                  backgroundColor:
                    percentage > 30 ? "#4c6ef5" : percentage > 10 ? "#f2b341" : "#ef5b68",
                }}
              />
            </div>
            <p className="text-[11px] text-[var(--ink-dim)] mt-2">
              Auto-forfeit in {Math.ceil(countdown)}s
            </p>
          </>
        ) : (
          <>
            <h2 className="text-[18px] font-bold font-[Fredoka] text-[var(--ink)] mb-2">
              Player disconnected
            </h2>
            <p className="text-[13px] text-[var(--ink-dim)] mb-5">
              <strong className="text-[var(--ink)]">{disconnectedPlayerName}</strong>{` `}
              lost connection. They have {Math.ceil(countdown)}s to reconnect before
              being removed.
            </p>

            <button
              onClick={onPlayWithout}
              className="w-full py-3 rounded-xl text-[14px] font-bold cursor-pointer bg-[var(--panel-2)] text-[var(--ink)] hover:bg-[var(--line)] transition-colors duration-200 border border-[var(--line)]"
            >
              Play without {disconnectedPlayerName}
            </button>

            {/* Countdown bar */}
            <div className="w-full h-2 rounded-full bg-[var(--panel-2)] overflow-hidden mt-4">
              <div
                className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                style={{
                  width: `${percentage}%`,
                  backgroundColor:
                    percentage > 30 ? "#4c6ef5" : percentage > 10 ? "#f2b341" : "#ef5b68",
                }}
              />
            </div>
            <p className="text-[11px] text-[var(--ink-dim)] mt-2">
              {Math.ceil(countdown)}s remaining
            </p>
          </>
        )}
      </div>
    </div>
  );
}
