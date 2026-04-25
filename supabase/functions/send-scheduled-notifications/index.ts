import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/client.ts";

const JSON_HDR = { ...corsHeaders, "Content-Type": "application/json" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HDR,
    });
  }

  const cronSecret = Deno.env.get("SCHEDULED_NOTIFICATIONS_SECRET");
  if (cronSecret) {
    const provided = req.headers.get("x-scheduled-secret") ?? "";
    if (provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: JSON_HDR,
      });
    }
  }

  const includeBirthdays = (Deno.env.get("ENABLE_BIRTHDAY_NOTIFICATIONS") ?? "false").toLowerCase() === "true";
  const now = new Date();
  const runDate = now.toISOString().slice(0, 10);
  const runHourUtc = now.getUTCHours();

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("send_scheduled_notifications", {
    p_run_date: runDate,
    p_run_hour: runHourUtc,
    p_include_birthdays: includeBirthdays,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: JSON_HDR,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      result: data,
    }),
    { status: 200, headers: JSON_HDR },
  );
});
