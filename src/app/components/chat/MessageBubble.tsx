import React, { useCallback, useRef } from "react";
import { Check, CheckCheck, Clock } from "lucide-react";

const REACTION_LONG_PRESS_MS = 520;
const REACTION_MOVE_CANCEL_PX = 14;

export type ReceiptPhase = "sending" | "sent" | "delivered" | "read";

export function MessageReceiptTicks({ phase }: { phase: ReceiptPhase }) {
  const gray = "text-gray-500 dark:text-zinc-400";
  const blue = "text-sky-600 dark:text-sky-400";
  if (phase === "sending") {
    return (
      <span className={`inline-flex items-center gap-0.5 ${gray}`} title="Sending">
        <Clock className="h-3.5 w-3.5" strokeWidth={2} />
        <Check className="h-3 w-3 opacity-60" strokeWidth={2.5} />
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

/** Small tail on the bubble corner (no avatars — tail points to thread edge). */
function BubbleTail({ mine }: { mine: boolean }) {
  if (mine) {
    return (
      <svg
        className="pointer-events-none absolute -right-1 bottom-0 z-0 h-3.5 w-2.5 text-emerald-500 dark:text-emerald-600"
        viewBox="0 0 10 14"
        aria-hidden
      >
        <path fill="currentColor" d="M0 14 L0 4 Q0 1 3 0 L10 2 L10 14 Z" />
      </svg>
    );
  }
  return (
    <svg
      className="pointer-events-none absolute -left-1 bottom-0 z-0 h-3.5 w-2.5 text-gray-200 dark:text-zinc-700"
      viewBox="0 0 10 14"
      aria-hidden
    >
      <path fill="currentColor" d="M10 14 L10 4 Q10 1 7 0 L0 2 L0 14 Z" />
    </svg>
  );
}

export type MessageBubbleProps = {
  mine: boolean;
  /** Shown above bubble (e.g. peer name for received, “You” for sent) */
  senderName: string;
  showSenderName: boolean;
  timeLabel: string;
  showMeta: boolean;
  receiptPhase: ReceiptPhase;
  /** Incoming message was read by current user (optional blue ticks on their bubble) */
  showIncomingRead?: boolean;
  isHighlighted: boolean;
  replySlot: React.ReactNode;
  children: React.ReactNode;
  /** Rendered directly under the bubble (e.g. product card) */
  belowBubbleSlot?: React.ReactNode;
  /** Aggregated emoji reactions below the bubble */
  reactions?: { emoji: string; count: number }[] | null;
  bubbleTransformStyle?: React.CSSProperties;
  edited?: boolean;
  /** Long-press (touch or primary mouse button) opens reaction picker in parent */
  onRequestReactionPicker?: () => void;
  /** When true, long-press is disabled (e.g. multi-select mode) */
  reactionInteractionDisabled?: boolean;
};

export function MessageBubble({
  mine,
  senderName,
  showSenderName,
  timeLabel,
  showMeta,
  receiptPhase,
  showIncomingRead,
  isHighlighted,
  replySlot,
  children,
  belowBubbleSlot,
  reactions,
  bubbleTransformStyle,
  edited,
  onRequestReactionPicker,
  reactionInteractionDisabled,
}: MessageBubbleProps) {
  const lpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpStartRef = useRef({ x: 0, y: 0 });

  const clearLongPress = useCallback(() => {
    if (lpTimerRef.current) {
      clearTimeout(lpTimerRef.current);
      lpTimerRef.current = null;
    }
  }, []);

  const onReactionPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onRequestReactionPicker || reactionInteractionDisabled) {
        // eslint-disable-next-line no-console
        console.log("[MessageBubble] pointerDown skipped", {
          hasCallback: !!onRequestReactionPicker,
          reactionInteractionDisabled: !!reactionInteractionDisabled,
        });
        return;
      }
      if (e.button !== 0) return;
      clearLongPress();
      lpStartRef.current = { x: e.clientX, y: e.clientY };
      // eslint-disable-next-line no-console
      console.log("[MessageBubble] long-press timer started", { pointerType: e.pointerType });
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      lpTimerRef.current = window.setTimeout(() => {
        lpTimerRef.current = null;
        // eslint-disable-next-line no-console
        console.log("Long press detected");
        // eslint-disable-next-line no-console
        console.log("[MessageBubble] calling onRequestReactionPicker");
        onRequestReactionPicker();
      }, REACTION_LONG_PRESS_MS);
    },
    [reactionInteractionDisabled, onRequestReactionPicker, clearLongPress],
  );

  const onReactionPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!lpTimerRef.current) return;
      if (
        Math.abs(e.clientX - lpStartRef.current.x) > REACTION_MOVE_CANCEL_PX ||
        Math.abs(e.clientY - lpStartRef.current.y) > REACTION_MOVE_CANCEL_PX
      ) {
        // eslint-disable-next-line no-console
        console.log("[MessageBubble] long-press cancelled (moved too far)");
        clearLongPress();
      }
    },
    [clearLongPress],
  );

  const onReactionPointerEnd = useCallback(
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
    ? "relative z-[1] rounded-2xl rounded-br-sm bg-emerald-500 text-white shadow-sm dark:bg-emerald-600"
    : "relative z-[1] rounded-2xl rounded-bl-sm bg-gray-200 text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100";

  return (
    <div
      className={`flex w-full min-w-0 touch-manipulation ${mine ? "justify-end" : "justify-start"}`}
      onPointerDown={onReactionPointerDown}
      onPointerMove={onReactionPointerMove}
      onPointerUp={onReactionPointerEnd}
      onPointerCancel={onReactionPointerEnd}
    >
      <div
        className={`flex min-w-0 max-w-[min(92%,26rem)] flex-col sm:max-w-[min(85%,28rem)] ${mine ? "items-end" : "items-start"}`}
        style={bubbleTransformStyle}
      >
        {showSenderName ? (
          <span className="mb-0.5 max-w-full truncate px-1 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">
            {senderName}
          </span>
        ) : null}

        <div className="relative w-full min-w-0">
          <div
            className={`relative ${bubbleClass} px-3 py-2 ${
              isHighlighted
                ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-emerald-50/80 dark:ring-emerald-500 dark:ring-offset-zinc-900"
                : ""
            }`}
          >
            <BubbleTail mine={mine} />
            <div className="relative z-[2]">{replySlot}</div>
            <div className="relative z-[2]">{children}</div>
          </div>
          {belowBubbleSlot}
        </div>

        {reactions?.length ? (
          <div
            className={`mt-1 flex max-w-full flex-wrap gap-1 ${mine ? "justify-end" : "justify-start"}`}
            aria-label="Reactions"
          >
            {reactions.map(({ emoji, count }) => (
              <span
                key={emoji}
                className="inline-flex items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-sm shadow-sm ring-1 ring-gray-200/80 dark:bg-zinc-800 dark:ring-zinc-600"
                title={`${count} reaction${count === 1 ? "" : "s"}`}
              >
                <span className="leading-none">{emoji}</span>
                {count > 1 ? (
                  <span className="text-[10px] font-semibold tabular-nums text-gray-600 dark:text-zinc-300">{count}</span>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}

        {showMeta ? (
          <div
            className={`mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-0.5 ${mine ? "justify-end" : "justify-start"}`}
          >
            {timeLabel ? (
              <span className="text-[11px] tabular-nums text-gray-500 dark:text-zinc-400">{timeLabel}</span>
            ) : null}
            {edited ? (
              <span className="text-[10px] font-medium text-gray-400 dark:text-zinc-500">edited</span>
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
