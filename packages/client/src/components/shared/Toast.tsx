import { useEffect, useState } from "react";

export interface ToastMessage {
  id: string;
  message: string;
  type: "info" | "error" | "success";
}

interface ToastProps {
  messages: ToastMessage[];
  onDismiss: (id: string) => void;
}

export default function Toast({ messages, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {messages.map((msg) => (
        <ToastItem key={msg.id} message={msg} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  message,
  onDismiss,
}: {
  message: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(message.id), 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  const bgColor =
    message.type === "error"
      ? "bg-[rgba(239,91,104,0.14)] border-[rgba(239,91,104,0.4)] text-[#ff9aa3]"
      : message.type === "success"
        ? "bg-[rgba(52,199,123,0.14)] border-[rgba(52,199,123,0.4)] text-[#34c77b]"
        : "bg-[var(--panel-2)] border-[var(--line)] text-[var(--ink)]";

  return (
    <div
      className={`
        pointer-events-auto rounded-xl px-5 py-3 border text-sm font-semibold
        transition-all duration-300 ease-out
        ${bgColor}
        ${visible ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"}
      `}
    >
      {message.message}
    </div>
  );
}
