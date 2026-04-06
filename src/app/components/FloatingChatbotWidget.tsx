import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { type ChatbotLanguage, invokeChatbotProcess } from "../utils/chatbotApi";

type ChatRole = "user" | "assistant";

type WidgetMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timeLabel: string;
};

const LANG_OPTIONS: { value: ChatbotLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "yo", label: "Yorùbá" },
  { value: "ig", label: "Igbo" },
  { value: "ha", label: "Hausa" },
];

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
    "Hi — I’m the GreenHub assistant. Ask about buying, selling, listings, or deliveries. I reply using our help training (English + local languages).",
  timeLabel: "",
};

export default function FloatingChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState<ChatbotLanguage>("en");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([WELCOME]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: WidgetMessage = {
      id: newId(),
      role: "user",
      content: text,
      timeLabel: timeNowLabel(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    try {
      const result = await invokeChatbotProcess(text, language);
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: "assistant",
          content: result.response,
          timeLabel: timeNowLabel(),
        },
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach assistant.");
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: "assistant",
          content:
            "Sorry — I couldn’t reach the assistant right now. Check your connection or try again in a moment.",
          timeLabel: timeNowLabel(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, language]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-end">
      <div className="pointer-events-auto flex flex-col items-end gap-3 pr-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-5 md:pr-5">
        {open ? (
          <div
            className="flex h-[min(72vh,520px)] w-[min(100vw-1.5rem,400px)] min-h-[300px] flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-2xl shadow-gray-900/15 ring-1 ring-black/5"
            role="dialog"
            aria-label="GreenHub assistant chat"
          >
            <header className="flex shrink-0 items-center gap-2 border-b border-emerald-800/20 bg-gradient-to-r from-[#15803d] to-[#16a34a] px-3 py-2.5 text-white">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">GreenHub Help</p>
                <p className="text-[11px] text-emerald-100/95">We typically reply instantly</p>
              </div>
              <label className="sr-only" htmlFor="floating-chatbot-lang">
                Language
              </label>
              <select
                id="floating-chatbot-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value as ChatbotLanguage)}
                className="max-w-[7.5rem] rounded-lg border border-white/25 bg-white/15 px-2 py-1.5 text-xs font-medium text-white outline-none ring-offset-2 ring-offset-[#15803d] focus:ring-2 focus:ring-white/50"
              >
                {LANG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="text-gray-900">
                    {o.label}
                  </option>
                ))}
              </select>
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
              {sending ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-gray-100 bg-white px-3 py-2 text-xs text-gray-500 shadow-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#16a34a]" aria-hidden />
                    …
                  </div>
                </div>
              ) : null}
            </div>

            <form
              className="shrink-0 border-t border-gray-100 bg-white p-2.5"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage();
              }}
            >
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message…"
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
                  autoComplete="off"
                  aria-label="Message"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
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
