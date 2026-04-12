import React, { useCallback, useState } from "react";
import { ImagePlus, Loader2, Mic, Paperclip, Send, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "../ui/utils";

export type ChatInputBarProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sendBusy: boolean;
  draftTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
  attachInputRef: React.RefObject<HTMLInputElement | null>;
  onAttachChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  attachAccept?: string;
  emojiPickerOpen: boolean;
  onEmojiPickerOpenChange: (open: boolean) => void;
  emojiList: string[];
  onEmojiInsert: (emoji: string) => void;
  enableMic?: boolean;
  recording?: boolean;
  onMicPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  attachIcon?: "paperclip" | "image-plus";
  leadingExtras?: React.ReactNode;
  placeholder?: string;
  className?: string;
};

/**
 * WhatsApp-style composer: idle shows attach · emoji · field · mic · send;
 * when focused or non-empty, mic hides and emoji moves inside the field pill.
 */
export function ChatInputBar({
  draft,
  onDraftChange,
  onSend,
  sendBusy,
  draftTextareaRef,
  attachInputRef,
  onAttachChange,
  attachAccept = "image/*",
  emojiPickerOpen,
  onEmojiPickerOpenChange,
  emojiList,
  onEmojiInsert,
  enableMic = false,
  recording = false,
  onMicPointerDown,
  attachIcon = "image-plus",
  leadingExtras,
  placeholder = "Message…",
  className,
}: ChatInputBarProps) {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const hasText = draft.trim().length > 0;
  const typingMode = isInputFocused || hasText;

  const handleAttachChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onAttachChange(e);
      requestAnimationFrame(() => draftTextareaRef.current?.focus());
    },
    [onAttachChange, draftTextareaRef],
  );

  const onEmojiMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const AttachIcon = attachIcon === "paperclip" ? Paperclip : ImagePlus;

  const emojiGrid = (
    <div className="grid max-h-[min(50vh,16rem)] grid-cols-6 gap-1 overflow-y-auto overscroll-contain sm:grid-cols-8">
      {emojiList.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-xl transition hover:bg-emerald-50 active:scale-95 dark:hover:bg-zinc-800"
          onMouseDown={onEmojiMouseDown}
          onClick={() => onEmojiInsert(emoji)}
          aria-label={`Insert ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  const emojiInsideField = (
    <Popover open={emojiPickerOpen} onOpenChange={onEmojiPickerOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseDown={onEmojiMouseDown}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-gray-600 transition-all duration-200 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-700/80"
          aria-label="Insert emoji"
          title="Emoji"
        >
          <Smile className="h-6 w-6" strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-[min(100vw-2rem,20rem)] touch-manipulation p-2">
        {emojiGrid}
      </PopoverContent>
    </Popover>
  );

  const sendActive = hasText && !sendBusy;
  const sendDisabled = sendBusy || !hasText;

  return (
    <div className={cn("flex flex-wrap items-end gap-1.5 sm:gap-2", className)}>
      <input ref={attachInputRef} type="file" accept={attachAccept} className="hidden" onChange={handleAttachChange} />
      <button
        type="button"
        onMouseDown={onEmojiMouseDown}
        onClick={() => attachInputRef.current?.click()}
        className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full text-gray-700 transition-colors duration-200 hover:bg-black/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"
        aria-label="Attach file"
      >
        <AttachIcon className="h-6 w-6" />
      </button>

      {leadingExtras}

      {!typingMode ? (
        <Popover open={emojiPickerOpen} onOpenChange={onEmojiPickerOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onMouseDown={onEmojiMouseDown}
              className="flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full text-gray-700 transition-all duration-200 hover:bg-black/[0.06] dark:text-zinc-200 dark:hover:bg-white/10"
              aria-label="Insert emoji"
              title="Emoji"
            >
              <Smile className="h-6 w-6" strokeWidth={2} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" sideOffset={8} className="w-[min(100vw-2rem,20rem)] touch-manipulation p-2">
            {emojiGrid}
          </PopoverContent>
        </Popover>
      ) : null}

      <div
        className={cn(
          "flex min-h-[44px] min-w-0 flex-1 items-stretch overflow-hidden rounded-full border border-[#d1d7db] bg-white shadow-sm transition-[box-shadow,border-color,padding] duration-200 focus-within:border-[#25D366] focus-within:ring-1 focus-within:ring-[#25D366] dark:border-zinc-600 dark:bg-zinc-800 dark:focus-within:ring-[#25D366]",
          typingMode ? "pl-0" : "pl-3",
        )}
      >
        {typingMode ? emojiInsideField : null}
        <textarea
          ref={draftTextareaRef}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!sendDisabled) void onSend();
            }
          }}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          rows={1}
          placeholder={placeholder}
          aria-label="Message"
          className={cn(
            "min-h-[44px] min-w-0 flex-1 resize-none bg-transparent py-2.5 pr-4 text-sm text-foreground outline-none placeholder:text-gray-400 dark:placeholder:text-zinc-500",
            typingMode ? "pl-0.5" : "pl-2",
          )}
        />
      </div>

      <div
        className={cn(
          "shrink-0 overflow-hidden transition-all duration-200 ease-out",
          enableMic && !typingMode ? "max-w-[44px] opacity-100" : "pointer-events-none max-w-0 opacity-0",
        )}
        aria-hidden={typingMode || !enableMic}
      >
        {enableMic ? (
          <button
            type="button"
            onPointerDown={onMicPointerDown}
            className={cn(
              "flex h-11 min-w-[44px] items-center justify-center rounded-full transition-colors duration-200",
              recording ? "bg-red-500 text-white" : "text-gray-700 hover:bg-black/[0.06] dark:text-zinc-200 dark:hover:bg-white/10",
            )}
            aria-label="Hold to record voice"
            title="Hold to record"
          >
            <Mic className="h-6 w-6" />
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void onSend()}
        disabled={sendDisabled}
        className={cn(
          "flex h-11 min-w-[44px] shrink-0 items-center justify-center rounded-full shadow-sm transition-all duration-200",
          sendActive ? "scale-100 bg-[#25D366] text-white hover:bg-[#20bd5a] dark:bg-[#25D366]" : "bg-[#25D366]/35 text-white dark:bg-[#25D366]/35",
          sendDisabled && "cursor-not-allowed opacity-60",
        )}
        aria-label="Send"
      >
        {sendBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
      </button>
    </div>
  );
}
