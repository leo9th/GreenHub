import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import {
  type TrainingDataRow,
  fetchAllApprovedTrainingForChat,
  logChatbotConversation,
  matchTrainingData,
  saveChatbotFeedback,
} from "../utils/chatbotApi";

type ChatRole = "user" | "assistant";

type WidgetMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timeLabel: string;
  /** User text that produced this assistant reply (for ratings). */
  sourceUserText?: string;
  feedbackVote?: -1 | 1;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function timeNowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const WELCOME: WidgetMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi — I’m the GreenHub assistant. I detect your language automatically (English, Yorùbá, Igbo, Hausa). Ask about buying, selling, delivery, payments, verification, or support.",
  timeLabel: "",
};

export default function FloatingChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<WidgetMessage[]>([WELCOME]);
  const [trainingRows, setTrainingRows] = useState<TrainingDataRow[]>([]);
  const [trainingLoading, setTrainingLoading] = useState(true);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastUserMessageRef = useRef<string | null>(null);
  const lastAssistantMessageRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTrainingLoading(true);
    setTrainingError(null);
    void fetchAllApprovedTrainingForChat()
      .then((rows) => {
        if (!cancelled) setTrainingRows(rows);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) {
          setTrainingRows([]);
          setTrainingError(e instanceof Error ? e.message : "Could not load training data.");
          toast.error(e instanceof Error ? e.message : "Could not load training data.");
        }
      })
      .finally(() => {
        if (!cancelled) setTrainingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const submitFeedbackVote = useCallback(
    async (msgId: string, sourceUserText: string, botResponse: string, rating: -1 | 1) => {
      const res = await saveChatbotFeedback({
        message: sourceUserText,
        botResponse,
        userRating: rating,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedbackVote: rating } : m)),
      );
      toast.success(rating === 1 ? "Thanks for the feedback." : "Thanks—we will use this to improve.");
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || trainingLoading) return;

    const result = matchTrainingData(text, trainingRows, {
      previousUserMessage: lastUserMessageRef.current,
      previousAssistantMessage: lastAssistantMessageRef.current,
    });

    lastUserMessageRef.current = text;
    lastAssistantMessageRef.current = result.response;

    void logChatbotConversation({
      message: text,
      response: result.response,
      language: result.language,
      intent: result.intent,
    });

    const userMsg: WidgetMessage = {
      id: newId(),
      role: "user",
      content: text,
      timeLabel: timeNowLabel(),
    };
    setMessages((m) => [
      ...m,
      userMsg,
      {
        id: newId(),
        role: "assistant",
        content: result.response,
        sourceUserText: text,
        timeLabel: timeNowLabel(),
      },
    ]);
    setInput("");
  }, [input, trainingRows, trainingLoading]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-end">
      <div className="pointer-events-auto flex flex-col items-end gap-3 pr-3 pb-[calc(6.25rem+env(safe-area-inset-bottom,0px))] md:pb-5 md:pr-5">
        {open ? (
          <div
            className="flex h-[min(72vh,520px)] w-[min(100vw-1.5rem,400px)] min-h-[300px] flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-2xl shadow-gray-900/15 ring-1 ring-black/5"
            role="dialog"
            aria-label="GreenHub assistant chat"
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-emerald-800/20 bg-gradient-to-r from-[#15803d] to-[#16a34a] px-3 py-2.5 text-white">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">GreenHub Help</p>
                <p className="text-[11px] text-emerald-100/95">
                  {trainingLoading
                    ? "Loading training data…"
                    : trainingError
                      ? "Training data unavailable"
                      : `${trainingRows.length} trained intent${trainingRows.length === 1 ? "" : "s"} · auto language · smart match`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/95 hover:bg-white/15"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/90 px-3 py-3"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                      msg.role === "user"
                        ? "rounded-br-md bg-[#16a34a] text-white"
                        : "rounded-bl-md border border-gray-100 bg-white text-gray-900"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.role === "assistant" && msg.sourceUserText ? (
                      <div className="mt-2 flex items-center gap-1 border-t border-gray-100 pt-2">
                        <span className="mr-1 text-[10px] text-gray-400">Helpful?</span>
                        <button
                          type="button"
                          disabled={msg.feedbackVote !== undefined}
                          onClick={() => void submitFeedbackVote(msg.id, msg.sourceUserText!, msg.content, 1)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
                            msg.feedbackVote === 1
                              ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          } disabled:opacity-50`}
                          aria-label="Thumbs up"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={msg.feedbackVote !== undefined}
                          onClick={() => void submitFeedbackVote(msg.id, msg.sourceUserText!, msg.content, -1)}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
                            msg.feedbackVote === -1
                              ? "border-red-400 bg-red-50 text-red-700"
                              : "border-gray-200 text-gray-500 hover:bg-gray-50"
                          } disabled:opacity-50`}
                          aria-label="Thumbs down"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                    {msg.timeLabel ? (
                      <p
                        className={`mt-1 text-[10px] tabular-nums ${
                          msg.role === "user" ? "text-emerald-100" : "text-gray-400"
                        }`}
                      >
                        {msg.timeLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            <form
              className="shrink-0 border-t border-gray-100 bg-white p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={trainingLoading ? "Loading…" : "Type a message…"}
                  disabled={trainingLoading}
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20 disabled:opacity-60"
                  autoComplete="off"
                  aria-label="Message"
                />
                <button
                  type="submit"
                  disabled={trainingLoading || !input.trim()}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#16a34a] text-white shadow-sm transition hover:bg-[#15803d] disabled:opacity-45"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#16a34a] text-2xl text-white shadow-lg shadow-emerald-900/25 ring-2 ring-white transition hover:bg-[#15803d] hover:shadow-xl md:h-[3.75rem] md:w-[3.75rem] md:text-[1.65rem]"
          aria-label={open ? "Close assistant" : "Open assistant"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6 text-white" aria-hidden /> : <span aria-hidden>💬</span>}
        </button>
      </div>
    </div>
  );
}
