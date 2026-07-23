import type { ConnectionState } from "../../hooks/useSocket";

interface ConnectionLostOverlayProps {
  state: ConnectionState;
  attempt: number;
  maxAttemptsBeforeManual: number;
  onManualRetry: () => void;
}

export default function ConnectionLostOverlay({
  state,
  attempt,
  maxAttemptsBeforeManual,
  onManualRetry,
}: ConnectionLostOverlayProps) {
  if (state === "connected") return null;

  const showManualRetry = state === "lost" || attempt >= maxAttemptsBeforeManual;
  const showDots = state === "connecting" && !showManualRetry;

  return (
    <div className="fixed inset-0 bg-[rgba(10,10,14,0.82)] backdrop-blur-[3px] flex items-center justify-center z-50">
      <div className="bg-[var(--panel)] border border-[var(--line)] rounded-2xl p-9 w-[340px] text-center">
        {/* Pulse dot */}
        <div className="w-[52px] h-[52px] mx-auto mb-5 rounded-full bg-[rgba(239,91,104,0.14)] flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border-2 border-[#ef5b68] animate-[pulseRing_1.6s_ease-out_infinite]" />
          <span className="text-[22px]">
            {state === "lost" ? "🔌" : "📡"}
          </span>
        </div>

        <h2 className="font-[Fredoka] font-semibold text-[19px] mb-2">
          {state === "lost"
            ? "Can't reconnect"
            : "Lost connection to Wildcard"}
        </h2>

        <p className="text-[14px] text-[var(--ink-dim)] leading-relaxed mb-5">
          {state === "lost"
            ? "We couldn't automatically reconnect after several tries. You can try again manually below."
            : "This isn't about your seat at the table — we can't reach the server at all right now. Your table is still there; we'll rejoin automatically the moment we're back."}
        </p>

        {showDots && (
          <div className="text-[12.5px] text-[var(--ink-dim)] mb-[18px]">
            Retrying
            <span className="inline-flex gap-[3px] ml-[2px]">
              <span className="w-[4px] h-[4px] rounded-full bg-[var(--ink-dim)] animate-[blink_1.4s_infinite]" />
              <span className="w-[4px] h-[4px] rounded-full bg-[var(--ink-dim)] animate-[blink_1.4s_infinite_0.2s]" />
              <span className="w-[4px] h-[4px] rounded-full bg-[var(--ink-dim)] animate-[blink_1.4s_infinite_0.4s]" />
            </span>{" "}
            attempt <b className="text-[var(--ink)]">{attempt}</b> of{" "}
            {maxAttemptsBeforeManual}
          </div>
        )}

        {showManualRetry && (
          <button
            onClick={onManualRetry}
            className="w-full border-none rounded-xl py-3.5 px-5 font-bold text-[14.5px] cursor-pointer bg-[var(--panel-2)] text-[var(--ink)] border border-[var(--line)] hover:-translate-y-0.5 transition-transform duration-180 ease-out"
          >
            Try again manually
          </button>
        )}
      </div>
    </div>
  );
}
