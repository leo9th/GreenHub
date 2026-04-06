import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseUserClient } from "../_shared/client.ts";

const JSON_HDR = { ...corsHeaders, "Content-Type": "application/json" };

function safeIntent(hint: unknown, msg: string): string {
  const h = typeof hint === "string" ? hint.trim().slice(0, 80) : "";
  if (h) return h.replace(/[^a-z0-9._-]+/gi, "_").replace(/^_+|_+$/g, "") || "user_correction";
  const base = msg
    .slice(0, 40)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `learned_${base || "query"}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HDR,
    });
  }

  try {
    const userClient = supabaseUserClient(req);
    const { data: { user } } = await userClient.auth.getUser();

    if (!user?.id) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: JSON_HDR,
      });
    }

    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? "").trim();
    const botResponse = String(body?.botResponse ?? "").trim();
    const correctedResponse = String(body?.correctedResponse ?? "").trim();
    const rawLang = String(body?.language ?? "en").trim();
    const language = ["yo", "ig", "ha", "en"].includes(rawLang) ? rawLang : "en";

    if (!message || !botResponse || !correctedResponse) {
      return new Response(
        JSON.stringify({ error: "message, botResponse, and correctedResponse are required" }),
        {
          status: 400,
          headers: JSON_HDR,
        },
      );
    }

    const admin = supabaseAdmin();
    const intent = safeIntent(body?.intentHint, message);

    const { error } = await admin.from("training_data").insert({
      intent,
      patterns: [message],
      responses: [correctedResponse],
      language,
      approved: false,
    });

    if (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: JSON_HDR,
      });
    }

    const { error: fbErr } = await admin.from("user_feedback").insert({
      user_id: user.id,
      message,
      bot_response: botResponse,
      user_rating: null,
      corrected_response: correctedResponse,
    });
    if (fbErr) console.warn("user_feedback audit:", fbErr.message);

    return new Response(JSON.stringify({ ok: true, intent }), { headers: JSON_HDR });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }), {
      status: 500,
      headers: JSON_HDR,
    });
  }
});
