import { supabase } from "../../lib/supabase";

export type ChatbotLanguage = "en" | "yo" | "ig" | "ha";

export type TrainingDataRow = {
  id: string;
  intent: string;
  patterns: string[];
  responses: string[];
  language: string;
};

/** Approved training rows for one locale (keyword source for the simple matcher). */
export async function fetchApprovedTrainingData(language: ChatbotLanguage): Promise<TrainingDataRow[]> {
  const { data, error } = await supabase
    .from("training_data")
    .select("id, intent, patterns, responses, language")
    .eq("approved", true)
    .eq("language", language);

  if (error) throw error;
  return (data ?? []) as TrainingDataRow[];
}

function pickResponse(responses: string[]): string {
  if (responses.length === 0) return "I’m not sure how to answer that yet.";
  const i = Math.floor(Math.random() * responses.length);
  return responses[i] ?? responses[0]!;
}

/**
 * First match wins by longest pattern substring (simple keyword-style matching).
 * User text is lowercased; each pattern is tested with `user.includes(pattern)`.
 */
export function matchTrainingData(
  userText: string,
  rows: TrainingDataRow[],
): { intent: string; response: string; unknown: boolean } {
  const normalized = userText.trim().toLowerCase();
  if (!normalized) {
    return { intent: "empty", response: "Type a message and I’ll try to help.", unknown: true };
  }

  let best: { intent: string; response: string; score: number } | null = null;

  for (const row of rows) {
    for (const rawPat of row.patterns ?? []) {
      const pat = rawPat.trim().toLowerCase();
      if (!pat) continue;
      if (normalized.includes(pat)) {
        const score = pat.length;
        if (!best || score > best.score) {
          best = {
            intent: row.intent,
            response: pickResponse(row.responses ?? []),
            score,
          };
        }
      }
    }
  }

  if (best) {
    return { intent: best.intent, response: best.response, unknown: false };
  }

  return {
    intent: "unknown",
    response:
      "I don’t have a trained answer for that yet. Try different words, switch language if needed, or visit our FAQ for more help.",
    unknown: true,
  };
}

// --- Optional Edge Function helpers (feedback / teach) ---

export type ChatProcessResult = {
  response: string;
  intent: string | null;
  unknown: boolean;
};

export type FeedbackPayload = {
  message: string;
  botResponse: string;
  userRating: -1 | 1;
};

export type TeachPayload = {
  message: string;
  botResponse: string;
  correctedResponse: string;
  language: ChatbotLanguage;
  intentHint?: string | null;
};

async function getFnErrorMessage(error: unknown, data: unknown): Promise<string> {
  if (error && typeof error === "object" && "message" in error) {
    const m = String((error as { message?: string }).message ?? "");
    if (m) return m;
  }
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: string }).error;
    if (e) return String(e);
  }
  return "Assistant is unavailable. Try again later.";
}

/** Calls Edge Function `chat` with the current session (if any). */
export async function invokeChatbotProcess(message: string, language: ChatbotLanguage): Promise<ChatProcessResult> {
  const body = { message: message.trim(), language };
  const { data, error } = await supabase.functions.invoke<ChatProcessResult>("chat", { body });

  if (error || !data || typeof (data as ChatProcessResult).response !== "string") {
    throw new Error(await getFnErrorMessage(error, data));
  }

  return {
    response: data.response,
    intent: data.intent ?? null,
    unknown: Boolean(data.unknown),
  };
}

export async function invokeChatbotFeedback(payload: FeedbackPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke("feedback", { body: payload });
  if (error) throw new Error(await getFnErrorMessage(error, data));
}

export async function invokeChatbotTeach(payload: TeachPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke("teach", { body: payload });
  if (error) throw new Error(await getFnErrorMessage(error, data));
}
