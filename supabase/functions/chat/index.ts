import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseUserClient } from "../_shared/client.ts";
import { matchTraining, unknownMessage, type TrainingRow } from "../_shared/match.ts";

const JSON_HDR = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HDR,
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? "").trim();
    const rawLang = String(body?.language ?? "en").trim();
    const language = ["yo", "ig", "ha", "en"].includes(rawLang) ? rawLang : "en";

    if (!message) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: JSON_HDR,
      });
    }

    const admin = supabaseAdmin();
    const userClient = supabaseUserClient(req);
    const { data: { user } } = await userClient.auth.getUser();

    const { data: rows, error: dbErr } = await admin
      .from("training_data")
      .select("intent, patterns, responses, language")
      .eq("approved", true)
      .in("language", [language, "en"]);

    if (dbErr) console.error("training_data:", dbErr.message);

    const training: TrainingRow[] = (rows ?? []).map((r) => ({
      intent: String(r.intent),
      patterns: Array.isArray(r.patterns) ? r.patterns.map((x) => String(x)) : [],
      responses: Array.isArray(r.responses) ? r.responses.map((x) => String(x)) : [],
      language: String(r.language ?? "en"),
    }));

    const hit = matchTraining(message, language, training);

    if (hit) {
      const { error: insErr } = await admin.from("chatbot_conversations").insert({
        user_id: user?.id ?? null,
        message,
        response: hit.response,
        language,
        intent: hit.intent,
      });
      if (insErr) console.error("chatbot_conversations:", insErr.message);

      return new Response(
        JSON.stringify({
          response: hit.response,
          intent: hit.intent,
          unknown: false,
        }),
        { headers: JSON_HDR },
      );
    }

    const fallback = unknownMessage(language);
    const { error: insErr2 } = await admin.from("chatbot_conversations").insert({
      user_id: user?.id ?? null,
      message,
      response: fallback,
      language,
      intent: null,
    });
    if (insErr2) console.error("chatbot_conversations:", insErr2.message);

    return new Response(
      JSON.stringify({
        response: fallback,
        intent: null,
        unknown: true,
      }),
      { headers: JSON_HDR },
    );
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }), {
      status: 500,
      headers: JSON_HDR,
    });
  }
});
