import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseUserClient } from "../_shared/client.ts";

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
    const botResponse = String(body?.botResponse ?? "").trim();
    const userRating = Number(body?.userRating);

    if (!message || !botResponse) {
      return new Response(JSON.stringify({ error: "message and botResponse are required" }), {
        status: 400,
        headers: JSON_HDR,
      });
    }
    if (userRating !== 1 && userRating !== -1) {
      return new Response(JSON.stringify({ error: "userRating must be 1 or -1" }), {
        status: 400,
        headers: JSON_HDR,
      });
    }

    const admin = supabaseAdmin();
    const userClient = supabaseUserClient(req);
    const { data: { user } } = await userClient.auth.getUser();

    const { error } = await admin.from("user_feedback").insert({
      user_id: user?.id ?? null,
      message,
      bot_response: botResponse,
      user_rating: userRating,
    });

    if (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: JSON_HDR,
      });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: JSON_HDR });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Server error" }), {
      status: 500,
      headers: JSON_HDR,
    });
  }
});
