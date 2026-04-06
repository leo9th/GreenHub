import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  Check,
  Loader2,
  MessageCircle,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase";
import type { ChatbotLanguage } from "../../utils/chatbotApi";

type Tab = "conversations" | "feedback" | "training";

type ConvoRow = {
  id: string;
  user_id: string | null;
  message: string;
  response: string;
  language: string;
  intent: string | null;
  created_at: string;
};

type FeedbackRow = {
  id: string;
  user_id: string | null;
  message: string;
  bot_response: string;
  user_rating: number | null;
  corrected_response: string | null;
  created_at: string;
};

type TrainingRow = {
  id: string;
  intent: string;
  patterns: string[];
  responses: string[];
  language: string;
  approved: boolean;
  created_at: string;
};

const LANGS: ChatbotLanguage[] = ["en", "yo", "ig", "ha"];

function clip(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

export default function AdminChatbotLearning() {
  const [tab, setTab] = useState<Tab>("conversations");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ConvoRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [pendingTraining, setPendingTraining] = useState<TrainingRow[]>([]);

  const [fromFeedback, setFromFeedback] = useState<FeedbackRow | null>(null);
  const [createIntent, setCreateIntent] = useState("help_custom");
  const [createLang, setCreateLang] = useState<ChatbotLanguage>("en");
  const [createPatterns, setCreatePatterns] = useState("");
  const [createResponses, setCreateResponses] = useState("");
  const [createApprove, setCreateApprove] = useState(true);
  const [createBusy, setCreateBusy] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [cRes, fRes, tRes] = await Promise.all([
      supabase
        .from("chatbot_conversations")
        .select("id, user_id, message, response, language, intent, created_at")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("user_feedback")
        .select("id, user_id, message, bot_response, user_rating, corrected_response, created_at")
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("training_data")
        .select("id, intent, patterns, responses, language, approved, created_at")
        .eq("approved", false)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (cRes.error) {
      setError(cRes.error.message);
      setLoading(false);
      return;
    }
    if (fRes.error) {
      setError(fRes.error.message);
      setLoading(false);
      return;
    }
    if (tRes.error) {
      setError(tRes.error.message);
      setLoading(false);
      return;
    }

    setConversations((cRes.data ?? []) as ConvoRow[]);
    setFeedback((fRes.data ?? []) as FeedbackRow[]);
    setPendingTraining((tRes.data ?? []) as TrainingRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const approveTraining = async (id: string) => {
    const { error: e } = await supabase.from("training_data").update({ approved: true }).eq("id", id);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success("Training approved.");
    void loadAll();
  };

  const deleteTraining = async (id: string) => {
    if (!confirm("Delete this pending training row?")) return;
    const { error: e } = await supabase.from("training_data").delete().eq("id", id);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success("Deleted.");
    void loadAll();
  };

  const submitCreateTraining = async () => {
    const intent = createIntent.trim();
    const patternLines = createPatterns
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const responseLines = createResponses
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!intent || patternLines.length === 0 || responseLines.length === 0) {
      toast.message("Intent, at least one pattern line, and one response line are required.");
      return;
    }

    setCreateBusy(true);
    const { error: e } = await supabase.from("training_data").insert({
      intent,
      patterns: patternLines,
      responses: responseLines,
      language: createLang,
      approved: createApprove,
    });
    setCreateBusy(false);
    if (e) {
      toast.error(e.message);
      return;
    }
    toast.success(createApprove ? "Training saved and approved." : "Training saved as pending.");
    setFromFeedback(null);
    setCreateIntent("help_custom");
    setCreatePatterns("");
    setCreateResponses("");
    setCreateApprove(true);
    void loadAll();
  };

  const openFromFeedback = (row: FeedbackRow) => {
    setFromFeedback(row);
    setCreatePatterns(row.message.trim());
    setCreateResponses((row.corrected_response ?? row.bot_response).trim());
    setTab("training");
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4">
          <Link
            to="/admin/dashboard"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <h1 className="text-lg font-bold text-gray-900">Chatbot learning</h1>
          <button
            type="button"
            onClick={() => void loadAll()}
            className="ml-auto inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="mx-auto flex max-w-5xl gap-1 border-t border-gray-100 px-4 pb-2 pt-2">
          {(
            [
              ["conversations", "Conversations"],
              ["feedback", "Feedback"],
              ["training", "Pending & add"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                tab === key
                  ? "bg-[#15803d] text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
            <p className="mt-2 text-xs text-red-700">
              Admins need <code className="rounded bg-red-100 px-1">app_metadata.role = admin</code> in Supabase
              Auth.
            </p>
          </div>
        ) : null}

        {loading && conversations.length === 0 && feedback.length === 0 ? (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        ) : null}

        {tab === "conversations" ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold text-gray-900">
                <MessageCircle className="h-5 w-5 text-[#15803d]" />
                Recent conversations
              </h2>
              <p className="text-xs text-gray-500">Each row is one user message and the bot reply that was shown.</p>
            </div>
            <div className="max-h-[min(70vh,560px)] overflow-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Language</th>
                    <th className="px-3 py-2 font-medium">Intent</th>
                    <th className="px-3 py-2 font-medium">User</th>
                    <th className="px-3 py-2 font-medium">Bot</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 align-top text-gray-800">
                      <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">{r.language}</td>
                      <td className="px-3 py-2">{r.intent ?? "—"}</td>
                      <td className="max-w-[200px] px-3 py-2">{clip(r.message, 120)}</td>
                      <td className="max-w-[240px] px-3 py-2 text-gray-600">{clip(r.response, 160)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {conversations.length === 0 && !loading ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">No rows yet.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "feedback" ? (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-4 py-3">
              <h2 className="font-semibold text-gray-900">User ratings</h2>
              <p className="text-xs text-gray-500">Thumbs up/down from the widget. Use “Add training” to turn a row into patterns.</p>
            </div>
            <div className="max-h-[min(70vh,560px)] overflow-auto">
              <table className="w-full text-left text-xs md:text-sm">
                <thead className="sticky top-0 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">Rating</th>
                    <th className="px-3 py-2 font-medium">User message</th>
                    <th className="px-3 py-2 font-medium">Bot reply</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {r.user_rating === 1 ? (
                          <ThumbsUp className="h-4 w-4 text-emerald-600" aria-label="Up" />
                        ) : r.user_rating === -1 ? (
                          <ThumbsDown className="h-4 w-4 text-red-500" aria-label="Down" />
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-[200px] px-3 py-2">{clip(r.message, 140)}</td>
                      <td className="max-w-[200px] px-3 py-2 text-gray-600">{clip(r.bot_response, 140)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openFromFeedback(r)}
                          className="text-xs font-medium text-[#15803d] hover:underline"
                        >
                          Add training
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {feedback.length === 0 && !loading ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">No feedback yet.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "training" ? (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-4 py-3">
                <h2 className="font-semibold text-gray-900">Pending training</h2>
                <p className="text-xs text-gray-500">Approve to start using these intents in the bot.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {pendingTraining.map((r) => (
                  <div key={r.id} className="flex flex-col gap-2 px-4 py-3 text-sm md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-gray-900">
                        {r.intent}{" "}
                        <span className="rounded bg-gray-100 px-1.5 text-xs font-normal text-gray-600">
                          {r.language}
                        </span>
                      </p>
                      <p className="text-xs text-gray-600">
                        <span className="font-medium text-gray-700">Patterns:</span>{" "}
                        {r.patterns.slice(0, 3).join(" · ")}
                        {r.patterns.length > 3 ? ` (+${r.patterns.length - 3})` : ""}
                      </p>
                      <p className="text-xs text-gray-600">{clip(r.responses[0] ?? "", 200)}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void approveTraining(r.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#15803d] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#166534]"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTraining(r.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {pendingTraining.length === 0 && !loading ? (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">No pending rows.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900">
                {fromFeedback ? "Training from feedback" : "Add training"}
              </h2>
              {fromFeedback ? (
                <p className="mb-3 text-xs text-gray-500">
                  Prefilled from feedback on {new Date(fromFeedback.created_at).toLocaleString()}. Edit before saving.
                </p>
              ) : (
                <p className="mb-3 text-xs text-gray-500">One pattern per line. One response per line (first is used at random with others).</p>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-xs font-medium text-gray-700">
                  Intent id
                  <input
                    value={createIntent}
                    onChange={(e) => setCreateIntent(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    placeholder="help_custom"
                  />
                </label>
                <label className="block text-xs font-medium text-gray-700">
                  Language
                  <select
                    value={createLang}
                    onChange={(e) => setCreateLang(e.target.value as ChatbotLanguage)}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    {LANGS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="mt-3 block text-xs font-medium text-gray-700">
                Patterns (one per line)
                <textarea
                  value={createPatterns}
                  onChange={(e) => setCreatePatterns(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono"
                />
              </label>

              <label className="mt-3 block text-xs font-medium text-gray-700">
                Responses (one per line)
                <textarea
                  value={createResponses}
                  onChange={(e) => setCreateResponses(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>

              <label className="mt-3 flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={createApprove}
                  onChange={(e) => setCreateApprove(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Approve immediately (bot can use after next page load)
              </label>

              <button
                type="button"
                disabled={createBusy}
                onClick={() => void submitCreateTraining()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#15803d] px-4 py-2 text-sm font-medium text-white hover:bg-[#166534] disabled:opacity-50"
              >
                {createBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save training
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
