import { useEffect, useState } from "react";

const MESSAGES = [
  "🌿 Growing GreenHub…",
  "🤖 Activating AI…",
  "🔐 Securing session…",
  "✨ Polishing green light…",
  "🚀 Almost ready…",
];

type Props = {
  /** When false, renders nothing */
  open?: boolean;
};

export function RadiumLoader({ open = true }: Props) {
  const [message, setMessage] = useState(MESSAGES[0] ?? "");

  useEffect(() => {
    if (!open) return;
    let i = 0;
    const interval = window.setInterval(() => {
      i = (i + 1) % MESSAGES.length;
      setMessage(MESSAGES[i] ?? "");
    }, 1500);
    return () => window.clearInterval(interval);
  }, [open]);

  if (!open) return null;

  return (
    <div className="radium-loader" role="status" aria-live="polite">
      <div className="relative mx-auto flex h-[140px] w-[180px] items-center justify-center">
        <div className="radium-rings" aria-hidden />
        <div className="radium-core" />
      </div>
      <p className="radium-text">{message}</p>
      <p className="radium-subtext">GreenHub · Intelligent marketplace</p>
    </div>
  );
}
