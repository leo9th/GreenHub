import type { LucideIcon } from "lucide-react";
import {
  Copy,
  Edit3,
  Eraser,
  Forward,
  Info,
  Pin,
  Reply,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { cn } from "../ui/utils";

export const MESSAGE_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export type MessageMenuV2Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Text selection for partial copy */
  selectedText: string;
  /** When false, only Reply, Copy, Forward, Star, Info (+ reactions). */
  isMine: boolean;
  onReply: () => void;
  onCopy: () => void;
  onCopySelected: () => void;
  onForward: () => void;
  onToggleStar: () => void;
  isStarred: boolean;
  onInfo: () => void;
  onReact: (emoji: string) => void;
  myReaction: string | null;
  onEdit?: () => void;
  onPin?: () => void;
  onDeleteForMe?: () => void;
  onDeleteForEveryone?: () => void;
  showDeleteForEveryone: boolean;
  onClearConversation?: () => void;
  showEdit: boolean;
};

function MenuRow({
  icon: Icon,
  label,
  onClick,
  destructive,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick()}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition",
        destructive
          ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          : "text-gray-900 hover:bg-gray-100 dark:text-zinc-100 dark:hover:bg-zinc-800",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <Icon className="h-5 w-5 shrink-0 opacity-80" />
      {label}
    </button>
  );
}

/**
 * WhatsApp-style action sheet (long-press on mobile). Desktop uses the same handlers via `ContextMenu`.
 */
export function MessageMenuV2({
  open,
  onOpenChange,
  selectedText,
  isMine,
  onReply,
  onCopy,
  onCopySelected,
  onForward,
  onToggleStar,
  isStarred,
  onInfo,
  onReact,
  myReaction,
  onEdit,
  onPin,
  onDeleteForMe,
  onDeleteForEveryone,
  showDeleteForEveryone,
  onClearConversation,
  showEdit,
}: MessageMenuV2Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[min(88vh,620px)] rounded-t-2xl border-t border-gray-200 bg-white p-0 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <SheetHeader className="border-b border-gray-100 px-4 pb-2 pt-2 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-left text-base font-semibold">Message</SheetTitle>
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => onOpenChange(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="overflow-y-auto overscroll-contain px-2 py-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex flex-wrap justify-center gap-2 border-b border-gray-100 pb-3 dark:border-zinc-800">
            {MESSAGE_QUICK_REACTIONS.map((emoji) => {
              const active = myReaction === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full text-xl transition",
                    active
                      ? "bg-emerald-100 ring-2 ring-emerald-400 dark:bg-emerald-950/60"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700",
                  )}
                  aria-label={`React ${emoji}`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>

          <MenuRow icon={Reply} label="Reply" onClick={onReply} />
          <MenuRow icon={Copy} label="Copy" onClick={onCopy} />
          <MenuRow
            icon={Copy}
            label="Copy selected text"
            onClick={onCopySelected}
            disabled={!selectedText.trim()}
          />
          <MenuRow icon={Forward} label="Forward" onClick={onForward} />
          <MenuRow
            icon={Star}
            label={isStarred ? "Unstar message" : "Star message"}
            onClick={onToggleStar}
          />

          {isMine && showEdit && onEdit ? <MenuRow icon={Edit3} label="Edit" onClick={onEdit} /> : null}
          {isMine && onPin ? <MenuRow icon={Pin} label="Pin" onClick={onPin} /> : null}
          <MenuRow icon={Info} label="Info" onClick={onInfo} />

          {isMine ? (
            <>
              <div className="my-2 border-t border-gray-100 dark:border-zinc-800" />
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500">
                Delete
              </p>
              {onDeleteForMe ? <MenuRow icon={Trash2} label="Delete for me" onClick={onDeleteForMe} destructive /> : null}
              {showDeleteForEveryone && onDeleteForEveryone ? (
                <MenuRow icon={Trash2} label="Delete for everyone" onClick={onDeleteForEveryone} destructive />
              ) : null}
              {onClearConversation ? (
                <>
                  <div className="my-2 border-t border-gray-100 dark:border-zinc-800" />
                  <MenuRow icon={Eraser} label="Clear all messages" onClick={onClearConversation} destructive />
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
