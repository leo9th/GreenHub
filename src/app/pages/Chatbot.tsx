import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Bot, Loader2, Send, User } from "lucide-react";
import { toast } from "sonner";
import {
  type ChatbotLanguage,
  type TrainingDataRow,
  fetchApprovedTrainingData,
  matchTrainingData,
} from "../utils/chatbotApi";

type ChatRole = "user" | "assistant";

type ChatbotMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timeLabel: string;
  intent?: string | null;
  unknown?: boolean;
};

const LANG_OPTIONS: { value: ChatbotLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "yo", label: "Yoruba" },
  { value: "ig", label: "Igbo" },
  { value: "ha", label: "Hausa" },
];

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function timeNowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Chatbot() {
  const navigate = useNavigate();
  const [language, setLanguage] = useState<ChatbotLanguage>("en");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [trainingRows, setTrainingRows] = useState<TrainingDataRow[]>([]);
  const [trainingLoading, setTrainingLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi — I’m the GreenHub helper. I answer from approved training phrases in your selected language. Try asking about buying, selling, or deliveries.",
        timeLabel: timeNowLabel(),
        intent: "welcome",
        unknown: false,
      },
    ]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTrainingLoading(true);
    void fetchApprovedTrainingData(language)
      .then((rows) => {
        if (!cancelled) setTrainingRows(rows);
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setTrainingRows([]);
          toast.error(e instanceof Error ? e.message : "Could not load training data.");
        }
      })
      .finally(() => {
        if (!cancelled) setTrainingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: ChatbotMessage = {
      id: newId(),
      role: "user",
      content: text,
      timeLabel: timeNowLabel(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    try {
      const result = matchTrainingData(text, trainingRows);
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: "assistant",
          content: result.response,
          timeLabel: timeNowLabel(),
          intent: result.intent,
          unknown: result.unknown,
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, trainingRows]);

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex flex-col bg-gray-100">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="-ml-1 rounded-lg p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold text-gray-900 truncate">GreenHub assistant</h1>
            <p className="text-xs text-gray-500 truncate">
              {trainingLoading ? "Loading training data…" : `${trainingRows.length} trained intents · keyword match`}
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:inline">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as ChatbotLanguage)}
              className="rounded-lg border border-gray-200 bg-white py-2 pl-2 pr-8 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-gray-200/80 ${
                  msg.role === "user" ? "bg-[#15803d] text-white" : "bg-white text-[#15803d]"
                }`}
              >
                {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`min-w-0 max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ring-1 ${
                  msg.role === "user"
                    ? "bg-[#16a34a] text-white ring-emerald-600/20"
                    : "bg-white text-gray-900 ring-gray-100"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <div
                  className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] ${
                    msg.role === "user" ? "text-emerald-100" : "text-gray-400"
                  }`}
                >
                  <span>{msg.timeLabel}</span>
                  {msg.role === "assistant" && msg.intent ? (
                    <>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">intent: {msg.intent}</span>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {sending ? (
            <div className="flex gap-2 pl-[3.25rem]">
              <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-gray-500 ring-1 ring-gray-100 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin text-[#16a34a]" aria-hidden />
                …
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-gray-200 bg-white pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <form
          className="mx-auto flex max-w-3xl gap-2 px-3 py-3 sm:px-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the assistant…"
            disabled={trainingLoading}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/25 disabled:opacity-60"
            autoComplete="off"
            aria-label="Message"
          />
          <button
            type="submit"
            disabled={sending || trainingLoading || !input.trim()}
            className="shrink-0 rounded-xl bg-[#16a34a] px-4 py-3 text-white shadow-sm hover:bg-[#15803d] disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Send"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
