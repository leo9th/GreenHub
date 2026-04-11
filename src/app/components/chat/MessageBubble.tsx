import React from "react";
import { Check, CheckCheck, Clock } from "lucide-react";
import { getAvatarUrl } from "../../utils/getAvatar";

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

/** Small tail pointing toward the avatar (left = received, right = sent). */
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
  /** Shown above bubble (e.g. peer name for received, “You” optional for sent) */
  senderName: string;
  showSenderName: boolean;
  timeLabel: string;
  showMeta: boolean;
  receiptPhase: ReceiptPhase;
  /** Incoming message was read by current user (optional blue ticks on their bubble) */
  showIncomingRead?: boolean;
  isHighlighted: boolean;
  avatarUrl: string;
  avatarDisplayName: string;
  /** First message in a cluster shows avatar + name; continuation messages hide avatar for cleaner thread */
  showAvatar: boolean;
  replySlot: React.ReactNode;
  children: React.ReactNode;
  /** Rendered directly under the bubble (e.g. product card), still aligned with the bubble column */
  belowBubbleSlot?: React.ReactNode;
  /** Reaction emoji shown under bubble (local UI) */
  reaction?: string | null;
  /** Swipe-to-reply transform (applied to bubble column only) */
  bubbleTransformStyle?: React.CSSProperties;
  /** Shown after timestamp when the message was edited */
  edited?: boolean;
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
  avatarUrl,
  avatarDisplayName,
  showAvatar,
  replySlot,
  children,
  belowBubbleSlot,
  reaction,
  bubbleTransformStyle,
  edited,
}: MessageBubbleProps) {
  const bubbleClass = mine
    ? "relative z-[1] rounded-2xl rounded-br-sm bg-emerald-500 text-white shadow-sm dark:bg-emerald-600"
    : "relative z-[1] rounded-2xl rounded-bl-sm bg-gray-200 text-gray-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100";

  return (
    <div
      className={`flex max-w-[min(92%,28rem)] min-w-0 items-end gap-2 ${mine ? "ml-auto flex-row-reverse" : "mr-auto flex-row"}`}
    >
      <div className={`flex shrink-0 flex-col ${showAvatar ? "" : "w-8 shrink-0"}`}>
        {showAvatar ? (
          <img
            src={avatarUrl || getAvatarUrl(null, null, avatarDisplayName)}
            alt=""
            className="h-8 w-8 rounded-full bg-gray-100 object-cover ring-1 ring-black/5 dark:bg-zinc-800 dark:ring-white/10"
          />
        ) : (
          <span className="block h-8 w-8 shrink-0" aria-hidden />
        )}
      </div>

      <div
        className={`flex min-w-0 max-w-[min(78%,22rem)] flex-col sm:max-w-[75%] ${mine ? "items-end" : "items-start"}`}
        style={bubbleTransformStyle}
      >
        {showSenderName ? (
          <span className="mb-0.5 max-w-full truncate px-1 text-[11px] font-semibold text-gray-500 dark:text-zinc-400">{senderName}</span>
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

        {reaction ? (
          <span
            className="mt-0.5 rounded-full bg-white px-1.5 py-0.5 text-base shadow-sm ring-1 ring-gray-200/80 dark:bg-zinc-800 dark:ring-zinc-600"
            title="Reaction"
          >
            {reaction}
          </span>
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
