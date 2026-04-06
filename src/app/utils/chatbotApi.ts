import { supabase } from "../../lib/supabase";

export type ChatbotLanguage = "en" | "yo" | "ig" | "ha";

export type TrainingDataRow = {
  id: string;
  intent: string;
  patterns: string[];
  responses: string[];
  language: string;
};

/** All approved rows (every language) — client filters by detected language + English fallback. */
export async function fetchAllApprovedTrainingForChat(): Promise<TrainingDataRow[]> {
  const { data, error } = await supabase
    .from("training_data")
    .select("id, intent, patterns, responses, language")
    .eq("approved", true);

  if (error) throw error;
  return (data ?? []) as TrainingDataRow[];
}

/** @deprecated Prefer fetchAllApprovedTrainingForChat — language is auto-detected per message. */
export async function fetchApprovedTrainingForChat(language: ChatbotLanguage): Promise<TrainingDataRow[]> {
  const langs: string[] = language === "en" ? ["en"] : [language, "en"];
  const { data, error } = await supabase
    .from("training_data")
    .select("id, intent, patterns, responses, language")
    .eq("approved", true)
    .in("language", langs);

  if (error) throw error;
  return (data ?? []) as TrainingDataRow[];
}

function pickResponse(responses: string[]): string {
  if (responses.length === 0) return "I’m not sure how to answer that yet.";
  const i = Math.floor(Math.random() * responses.length);
  return responses[i] ?? responses[0]!;
}

// --- Normalization & tokenization -------------------------------------------------

const EN_STOP = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "can",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "again",
  "further",
  "then",
  "once",
  "i",
  "me",
  "my",
  "we",
  "our",
  "you",
  "your",
  "he",
  "him",
  "his",
  "she",
  "her",
  "it",
  "its",
  "they",
  "them",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "this",
  "that",
  "these",
  "those",
  "am",
  "and",
  "but",
  "if",
  "or",
  "because",
  "until",
  "while",
  "about",
  "against",
  "between",
  "into",
  "through",
  "during",
  "how",
  "when",
  "where",
  "why",
  "all",
  "each",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",
]);

function normalizeForMatch(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const n = normalizeForMatch(text);
  if (!n) return [];
  return n.split(/\s+/).filter((w) => w.length > 0);
}

function tokenSetForScore(tokens: string[], useStopwords: boolean): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    if (useStopwords && t.length <= 2) continue;
    if (useStopwords && EN_STOP.has(t)) continue;
    out.add(t);
  }
  return out;
}

// --- Language detection (heuristic: keywords + script hints) ----------------------

const LANG_HINTS: Record<Exclude<ChatbotLanguage, "en">, string[]> = {
  yo: [
    "bawo",
    "kini",
    "ṣe",
    "mo",
    "pelu",
    "sugbon",
    "tabi",
    "iranlowo",
    "owo",
    "isinmi",
    "sisan",
    "yoruba",
    "funmi",
    "ejo",
    "jọwọ",
    "ra",
    "ta",
    "nile",
    "lati",
    "gba",
    "sise",
    "alabara",
  ],
  ig: [
    "kedu",
    "biko",
    "nke",
    "gị",
    "enyemaka",
    "ịzụ",
    "ịga",
    "ugbu",
    "anyị",
    "igbo",
    "ụlọ",
    "ịnyị",
    "bụ",
    "nzụ",
    "ịkwụ",
    "ụgwọ",
    "nye",
  ],
  ha: [
    "wannan",
    "yana",
    "ina",
    "kuma",
    "don",
    "taimako",
    "saya",
    "sayarwa",
    "kudi",
    "lokaci",
    "amfani",
    "guda",
    "haka",
    "kada",
    "yadda",
    "samun",
    "saboda",
    "hausawa",
    "gobe",
    "yau",
  ],
};

const YORUBA_SCRIPT = /[ẹọṣẹṢṢàáèéìíòóùúọ̀ọ́ẸỌ]/;
const IGBO_SCRIPT = /[ịụṅụỊỤ]/;
const HAUSA_SCRIPT = /[ɗƙƴɓ]/i;

export function detectChatLanguage(text: string): ChatbotLanguage {
  const raw = text.trim();
  if (!raw) return "en";

  const tokens = tokenize(raw);
  const joined = normalizeForMatch(raw);

  let scoreYo = 0;
  let scoreIg = 0;
  let scoreHa = 0;

  const tokSet = new Set(tokens.map((t) => t.toLowerCase()));

  for (const w of LANG_HINTS.yo) {
    if (tokSet.has(w) || joined.includes(w)) scoreYo += w.length >= 3 ? 3 : 1;
  }
  for (const w of LANG_HINTS.ig) {
    if (w.length <= 2) {
      if (tokSet.has(w)) scoreIg += 1;
    } else if (tokSet.has(w) || joined.includes(w)) {
      scoreIg += 3;
    }
  }
  for (const w of LANG_HINTS.ha) {
    if (tokSet.has(w) || joined.includes(w)) scoreHa += w.length >= 3 ? 3 : 1;
  }

  if (YORUBA_SCRIPT.test(raw)) scoreYo += 4;
  if (IGBO_SCRIPT.test(raw)) scoreIg += 4;
  if (HAUSA_SCRIPT.test(raw)) scoreHa += 5;

  const max = Math.max(scoreYo, scoreIg, scoreHa);
  if (max < 4) return "en";

  if (scoreYo === max && scoreYo >= scoreIg && scoreYo >= scoreHa) return "yo";
  if (scoreIg === max && scoreIg >= scoreHa) return "ig";
  if (scoreHa === max) return "ha";

  return "en";
}

// --- Follow-up / context ---------------------------------------------------------

const FOLLOW_UP_LINE = /^(yes|no|yeah|yep|nope|ok|okay|sure|please|thanks|thank you|more|how|why|what|and|same|this|that)\b/i;
const FOLLOW_UP_SHORT = /^(ok|no|yes|how|why|what|more)$/i;

function isLikelyFollowUp(current: string): boolean {
  const t = current.trim();
  if (!t) return false;
  if (t.length <= 18 && FOLLOW_UP_SHORT.test(t)) return true;
  if (t.length <= 40 && FOLLOW_UP_LINE.test(t)) return true;
  const words = tokenize(t);
  if (words.length <= 2 && t.length <= 24) return true;
  return false;
}

export function buildEffectiveUserText(
  currentUserText: string,
  previousUserMessage: string | null,
): string {
  const cur = currentUserText.trim();
  if (!cur) return cur;
  if (!previousUserMessage?.trim()) return cur;
  if (!isLikelyFollowUp(cur)) return cur;
  return `${previousUserMessage.trim()} ${cur}`;
}

function rowsForLanguage(rows: TrainingDataRow[], lang: ChatbotLanguage): TrainingDataRow[] {
  if (lang === "en") return rows.filter((r) => r.language === "en");
  const primary = rows.filter((r) => r.language === lang || r.language === "en");
  return primary.length > 0 ? primary : rows.filter((r) => r.language === "en");
}

// --- Pattern scoring (phrase + token overlap + light typo tolerance) ------------

function diceCoefficient(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const bigrams = (arr: string[]) => {
    const out: string[] = [];
    for (let i = 0; i < arr.length - 1; i++) out.push(`${arr[i]} ${arr[i + 1]}`);
    return out;
  };
  const ba = bigrams(a);
  const bb = bigrams(b);
  if (ba.length === 0 || bb.length === 0) {
    const sa = new Set(a);
    let hit = 0;
    for (const x of b) if (sa.has(x)) hit++;
    return hit / Math.max(1, Math.min(a.length, b.length));
  }
  const sb = new Set(bb);
  let inter = 0;
  for (const x of ba) if (sb.has(x)) inter++;
  return (2 * inter) / (ba.length + bb.length);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev + cost, row[j]! + 1, row[j - 1]! + 1);
      prev = tmp;
    }
  }
  return row[b.length]!;
}

function wordTypoMatch(uw: string, pw: string): boolean {
  if (uw === pw) return true;
  if (uw.length < 4 || pw.length < 4) return false;
  return levenshtein(uw, pw) <= 1;
}

/** Phrase match, or single-token match as a whole word only (avoids "buy" matching inside "buying"). */
function includesPhraseOrWholeWord(fullNorm: string, needleNorm: string): boolean {
  const n = needleNorm.trim();
  if (!n) return false;
  if (n.includes(" ")) return fullNorm.includes(n);
  const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, "i");
    return re.test(fullNorm);
  } catch {
    return fullNorm.includes(n);
  }
}

function isBuyVsBoostContrast(userNorm: string): boolean {
  const hasBoost = /\b(boost|boosted|boosting|advertising|advertise|advertisement|promotion|promote|sponsor|sponsored|visibility\s+tier)\b/.test(
    userNorm,
  );
  const hasBuy = /\b(buy|buying|purchase|purchasing|shop|shopping|cart|checkout|order|ordering)\b/.test(userNorm);
  const hasContrast = /\b(different|not the same|vs|versus|not that|compare|confused|instead|rather than|same as)\b/.test(
    userNorm,
  );
  return hasBoost && hasBuy && hasContrast;
}

const BUY_VS_BOOST_DISAMBIG: Record<ChatbotLanguage, string> = {
  en: `Buying and boosting are different: buying is when you shop and pay for products as a customer. Boosting is for sellers—it pays to increase visibility for your own listing. To shop, browse products and use checkout. To boost, go to Seller → Advertise (or your product’s Boost options) and complete payment.`,

  yo: `Ṣiṣẹ ra ati imudara ifihan jẹ oriṣiriṣi: ra tumọ si nipa ti o ra awọn ọja bi onibara. Imudara ifihan fun awọn olota nikan—o san lati mu akosile rẹ han siwaju. Lati ra, ṣawari ọja ki o lo ideri. Lati mu akosile rẹ han, lọ si Olota → Ipolongo tabi awọn aṣayan Boost fun ọja naa.`,

  ig: `Ịzụ na ime ka ọpụrụiche abụghị otu: ịzụ bụ mgbe ị na-azụ ihe dị ka onye na-azụ ahịa. Ime ka ọpụrụiche bụ maka ndị na-ere—ị na-akwụ ụgwọ ka a hụ ọkachamara gị nke ọma. Iji zụta, lelee ngwaahịa ma jiri nkwụọ. Iji mee ka ọpụrụiche, gaa na Onye na-ere → Mgbasa ozi (ma ọ bụ nhọrọ Boost maka ngwaahịa ahụ).`,

  ha: `Sayayya da ƙarfafa bayanai babi ne daban: sayaywa shine ku sayi kayayyakin ku a matsayin mai sayayya. Ƙarfafa shine don masu sayarwa—kuna biyan kuɗi don ƙara ganin samfurin ku. Don sayayya, bincika samfuran ku kuma amfani da biyan kuɗi. Don ƙarfafa, je Mai sayarwa → Talla (ko zaɓukan Boost na samfurin).`,
};

function scorePattern(userNorm: string, userTokens: string[], userSet: Set<string>, patternRaw: string): number {
  const patNorm = normalizeForMatch(patternRaw);
  if (!patNorm) return 0;

  if (includesPhraseOrWholeWord(userNorm, patNorm)) {
    return 10_000 + patNorm.length * 50 + Math.min(500, patNorm.split(/\s+/).length * 80);
  }

  const patTokens = tokenize(patternRaw);
  if (patTokens.length === 0) return 0;

  const patSet = tokenSetForScore(patTokens, true);
  let overlap = 0;
  let weighted = 0;
  for (const pw of patSet) {
    let hit = false;
    if (userSet.has(pw)) {
      hit = true;
    } else {
      for (const uw of userTokens) {
        if (wordTypoMatch(uw, pw)) {
          hit = true;
          break;
        }
      }
    }
    if (hit) {
      overlap += 1;
      weighted += 12 + Math.min(20, pw.length);
    }
  }

  const recall = overlap / Math.max(1, patSet.size);
  const dice = diceCoefficient(patTokens, userTokens);

  let score = recall * 2_500 + dice * 800 + weighted;

  for (const pw of patTokens) {
    if (pw.length >= 4 && includesPhraseOrWholeWord(userNorm, pw)) score += 120 + pw.length * 8;
  }

  return score;
}

export type MatchContext = {
  /** Previous user message text (for short follow-ups like “same”, “how?”). */
  previousUserMessage?: string | null;
  /** Reserved for future use (e.g. clarifying questions). */
  previousAssistantMessage?: string | null;
  /** If omitted, language is detected from the effective user text. */
  language?: ChatbotLanguage;
};

export type MatchResult = {
  intent: string;
  response: string;
  unknown: boolean;
  language: ChatbotLanguage;
};

export function matchTrainingData(
  userText: string,
  rows: TrainingDataRow[],
  context?: MatchContext,
): MatchResult {
  const trimmed = userText.trim();
  if (!trimmed) {
    return {
      intent: "empty",
      response: "Type a message and I’ll try to help.",
      unknown: true,
      language: "en",
    };
  }

  const prev = context?.previousUserMessage ?? null;
  const effective = buildEffectiveUserText(trimmed, prev);
  const lang =
    context?.language ??
    (isLikelyFollowUp(trimmed) && prev?.trim()
      ? detectChatLanguage(effective)
      : detectChatLanguage(trimmed));

  const scoped = rowsForLanguage(rows, lang);
  const userNorm = normalizeForMatch(effective);
  if (isBuyVsBoostContrast(userNorm)) {
    return {
      intent: "disambiguate_buy_boost",
      response: BUY_VS_BOOST_DISAMBIG[lang] ?? BUY_VS_BOOST_DISAMBIG.en,
      unknown: false,
      language: lang,
    };
  }

  const userTokens = tokenize(effective);
  const userSet = tokenSetForScore(userTokens, true);

  let best: { intent: string; response: string; score: number } | null = null;

  for (const row of scoped) {
    for (const rawPat of row.patterns ?? []) {
      const s = scorePattern(userNorm, userTokens, userSet, rawPat);
      if (s > 0 && (!best || s > best.score)) {
        best = {
          intent: row.intent,
          response: pickResponse(row.responses ?? []),
          score: s,
        };
      }
    }
  }

  const MIN_SCORE = 220;
  if (best && best.score >= MIN_SCORE) {
    return { intent: best.intent, response: best.response, unknown: false, language: lang };
  }

  return {
    intent: "unknown",
    response: fallbackHelpResponse(lang),
    unknown: true,
    language: lang,
  };
}

function fallbackHelpResponse(lang: ChatbotLanguage): string {
  const blocks: Record<ChatbotLanguage, string> = {
    en: `I’m not sure I understood that. Could you rephrase your question, or pick a topic?

• How to buy on GreenHub
• How to sell on GreenHub
• Delivery options
• Payment methods
• Account verification
• Contact support

A short, specific question works best (for example: “How do I pay for an order?”).`,

    yo: `Ko ye mi gidigidi. Ṣe o le sọ ọ rẹ ni ọna miiran, tabi yan ọkan ninu awọn koko yii?

• Bii ṣe o ṣe ra lori GreenHub
• Bii ṣe o ṣe ta lori GreenHub
• Awọn aṣayan isinmi
• Awọn ọna sisan owo
• Ijẹrisi akọọlẹ
• Kan si atilẹyin

Ibẹrẹ to kukuru ati pato dara julọ.`,

    ig: `Aghọtaghị m nke ọma. Ị nwere ike ịkwụghachi ma ọ bụ họrọ isiokwu:

• Otu e si azụ na GreenHub
• Otu e si ree na GreenHub
• Nhọrọ nnyefe
• Ụzọ ịkwụ ụgwọ
• Nkwenye akaụntụ
• Kpọtụrụ ndị nkwado

Ajụjụ dị mkpirikpi na nke dabara adaba ka mma.`,

    ha: `Ban gane sosai. Za ku iya sake yin tambaya ko ku zaɓi wannan:

• Yaya a saya a GreenHub
• Yaya a sayar da GreenHub
• Zaɓuɓɓukan isar da kaya
• Hanyoyin biyan kuɗi
• Tabbatar da asusu
• Tuntuɓar goyan baya

Tambaya ta gajeren kalma tana da kyau.`,

  };
  return blocks[lang];
}

// --- Optional Edge Function helpers (feedback / teach) ---

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

export async function invokeChatbotFeedback(payload: FeedbackPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke("feedback", { body: payload });
  if (error) throw new Error(await getFnErrorMessage(error, data));
}

export async function invokeChatbotTeach(payload: TeachPayload): Promise<void> {
  const { data, error } = await supabase.functions.invoke("teach", { body: payload });
  if (error) throw new Error(await getFnErrorMessage(error, data));
}

// --- Direct Supabase learning tables (used by FloatingChatbotWidget + admin review) -----

/** Saves one user message and assistant reply for admin review. Fails silently except console. */
export async function logChatbotConversation(params: {
  message: string;
  response: string;
  language: ChatbotLanguage;
  intent: string;
}): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("chatbot_conversations").insert({
      user_id: user?.id ?? null,
      message: params.message,
      response: params.response,
      language: params.language,
      intent: params.intent,
    });
    if (error) console.error("logChatbotConversation:", error.message);
  } catch (e) {
    console.error("logChatbotConversation:", e);
  }
}

export type SaveFeedbackResult = { ok: true } | { ok: false; message: string };

/** Thumbs on a bot turn → `user_feedback`. */
export async function saveChatbotFeedback(params: {
  message: string;
  botResponse: string;
  userRating: -1 | 1;
}): Promise<SaveFeedbackResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("user_feedback").insert({
    user_id: user?.id ?? null,
    message: params.message,
    bot_response: params.botResponse,
    user_rating: params.userRating,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
