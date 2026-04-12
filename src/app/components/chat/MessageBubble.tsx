import React, { useCallback, useRef } from "react";
import { Check, CheckCheck, Clock } from "lucide-react";
import type { ChatReactionSummary } from "../../utils/chatMessages";

const ACTIONS_LONG_PRESS_MS = 480;
const ACTIONS_MOVE_CANCEL_PX = 14;

export type ReceiptPhase = "sending" | "sent" | "delivered" | "read";

export function MessageReceiptTicks({ phase }: { phase: ReceiptPhase }) {
  const gray = "text-white/80";
  const blue = "text-sky-200";
  if (phase === "sending") {
    return (
      <span className={`inline-flex items-center gap-0.5 ${gray}`} title="Sending">
        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }
  if (phase === "sent") {
    return (
      <span className={gray} title="Sent">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  if (phase === "delivered") {
    return (
      <span className={gray} title="Delivered">
        <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className={blue} title="Read">
      <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
    </span>
  );
}

export type MessageBubbleProps = {
  mine: boolean;
  timeLabel: string;
  showMeta: boolean;
  receiptPhase: ReceiptPhase;
  /** Optional blue ticks on their bubble when you’ve read it (rare in 1:1) */
  showIncomingRead?: boolean;
  isHighlighted: boolean;
  replySlot: React.ReactNode;
  children: React.ReactNode;
  /** Listing card under bubble */
  belowBubbleSlot?: React.ReactNode;
  /** Aggregated emoji reactions (optional; omitted when table unavailable) */
  reactions?: ChatReactionSummary[] | null;
  edited?: boolean;
  /** Long-press / hold to open actions (mobile); desktop uses right-click menu on parent */
  onRequestActions?: () => void;
  actionsDisabled?: boolean;
};

export function MessageBubble({
  mine,
  timeLabel,
  showMeta,
  receiptPhase,
  showIncomingRead,
  isHighlighted,
  replySlot,
  children,
  belowBubbleSlot,
  reactions,
  edited,
  onRequestActions,
  actionsDisabled,
}: MessageBubbleProps) {
  const lpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpStartRef = useRef({ x: 0, y: 0 });

  const clearLongPress = useCallback(() => {
    if (lpTimerRef.current) {
      clearTimeout(lpTimerRef.current);
      lpTimerRef.current = null;
    }
  }, []);

  const onActionsPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onRequestActions || actionsDisabled) return;
      if (e.button !== 0) return;
      clearLongPress();
      lpStartRef.current = { x: e.clientX, y: e.clientY };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      lpTimerRef.current = window.setTimeout(() => {
        lpTimerRef.current = null;
        onRequestActions();
      }, ACTIONS_LONG_PRESS_MS);
    },
    [actionsDisabled, onRequestActions, clearLongPress],
  );

  const onActionsPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!lpTimerRef.current) return;
      if (
        Math.abs(e.clientX - lpStartRef.current.x) > ACTIONS_MOVE_CANCEL_PX ||
        Math.abs(e.clientY - lpStartRef.current.y) > ACTIONS_MOVE_CANCEL_PX
      ) {
        clearLongPress();
      }
    },
    [clearLongPress],
  );

  const onActionsPointerEnd = useCallback(
    (e: React.PointerEvent) => {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      clearLongPress();
    },
    [clearLongPress],
  );

  const bubbleClass = mine
    ? "relative z-[1] rounded-lg rounded-br-sm bg-[#25D366] text-white shadow-sm"
    : "relative z-[1] rounded-lg rounded-bl-sm bg-white text-gray-900 shadow-sm ring-1 ring-black/[0.06] dark:bg-zinc-700 dark:text-zinc-100 dark:ring-white/10";

  const metaMine = "text-[11px] text-white/85";
  const metaTheirs = "text-[11px] text-gray-500 dark:text-zinc-400";

  return (
    <div
      className={`flex w-full min-w-0 touch-manipulation ${mine ? "justify-end" : "justify-start"}`}
      onPointerDown={onActionsPointerDown}
      onPointerMove={onActionsPointerMove}
      onPointerUp={onActionsPointerEnd}
      onPointerCancel={onActionsPointerEnd}
    >
      <div className={`flex min-w-0 max-w-[min(92%,26rem)] flex-col sm:max-w-[min(85%,28rem)] ${mine ? "items-end" : "items-start"}`}>
        <div className="relative w-full min-w-0">
          <div
            className={`relative ${bubbleClass} px-3 py-2 ${
              isHighlighted
                ? mine
                  ? "ring-2 ring-white/80 ring-offset-2 ring-offset-[#25D366]"
                  : "ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#ece5dd] dark:ring-offset-zinc-900"
                : ""
            }`}
          >
            <div className="relative z-[2]">{replySlot}</div>
            <div className="relative z-[2]">{children}</div>
          </div>
          {reactions && reactions.length > 0 ? (
            <div
              className={`mt-0.5 flex max-w-full flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}
              aria-label="Reactions"
            >
              {reactions.map((r) => (
                <span
                  key={r.emoji}
                  className={`inline-flex items-center gap-0.5 rounded-full border border-black/[0.06] bg-white/95 px-1.5 py-0.5 text-[11px] leading-none shadow-sm ring-1 ring-black/[0.04] dark:border-white/10 dark:bg-zinc-600/95 dark:ring-white/10`}
                  title={`${r.count}`}
                >
                  <span className="leading-none">{r.emoji}</span>
                  {r.count > 1 ? <span className="text-[10px] font-semibold text-gray-600 dark:text-zinc-200">{r.count}</span> : null}
                </span>
              ))}
            </div>
          ) : null}
          {belowBubbleSlot}
        </div>

        {showMeta ? (
          <div
            className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-0.5 ${mine ? "justify-end" : "justify-start"}`}
          >
            {timeLabel ? <span className={`tabular-nums ${mine ? metaMine : metaTheirs}`}>{timeLabel}</span> : null}
            {edited ? (
              <span className={`text-[10px] font-medium ${mine ? "text-white/70" : "text-gray-400 dark:text-zinc-500"}`}>
                edited
              </span>
            ) : null}
            {mine ? <MessageReceiptTicks phase={receiptPhase} /> : null}
            {!mine && showIncomingRead ? (
              <span className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400" title="You read this message">
                <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
