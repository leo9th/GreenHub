import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/client.ts";

const JSON_HDR = { ...corsHeaders, "Content-Type": "application/json" };

type CampaignKey = "weekend_greeting" | "birthday_greeting";

type CandidateRow = {
  id: string;
  full_name: string | null;
  birthday_date: string | null;
  created_at: string | null;
  notification_preferences: Record<string, unknown> | null;
};

type CampaignCounts = {
  attempted: number;
  inserted: number;
  skipped_optout: number;
  skipped_duplicate: number;
  errors: number;
};

function campaignTitle(campaign: CampaignKey): string {
  if (campaign === "birthday_greeting") return "Happy Birthday from GreenHub!";
  return "Weekend reminder";
}

function campaignBody(campaign: CampaignKey, fullName: string | null): string {
  if (campaign === "birthday_greeting") {
    const greetingName = fullName?.trim() || "there";
    return `Happy Birthday, ${greetingName}! Wishing you a wonderful day from all of us at GreenHub.`;
  }
  return "Weekend is a great time to buy, sell, and book deliveries on GreenHub.";
}

function periodKeyFor(campaign: CampaignKey, now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  if (campaign === "birthday_greeting") return `${year}-${month}-${day}`;

  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((now.getTime() - jan1.getTime()) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function wantsCampaign(row: CandidateRow, campaign: CampaignKey): boolean {
  const pref = row.notification_preferences ?? {};
  const key = campaign === "weekend_greeting" ? "weekend_marketing" : "birthday_greetings";
  const value = pref[key];
  return value !== false;
}

function isBirthdayMatch(row: CandidateRow, now: Date): boolean {
  if (!row.birthday_date) return false;
  const d = new Date(`${row.birthday_date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate();
}

function isWeekendEligibleBySignupHour(row: CandidateRow, now: Date): boolean {
  const dow = now.getUTCDay(); // Sun=0, Sat=6
  if (dow !== 0 && dow !== 6) return false;
  if (!row.created_at) return false;
  const created = new Date(row.created_at);
  if (Number.isNaN(created.getTime())) return false;
  return created.getUTCHours() === now.getUTCHours();
}

async function runCampaign(
  admin: ReturnType<typeof supabaseAdmin>,
  candidates: CandidateRow[],
  campaign: CampaignKey,
  now: Date,
): Promise<CampaignCounts> {
  const counts: CampaignCounts = {
    attempted: 0,
    inserted: 0,
    skipped_optout: 0,
    skipped_duplicate: 0,
    errors: 0,
  };
  const periodKey = periodKeyFor(campaign, now);

  for (const row of candidates) {
    let eligible = false;
    if (campaign === "birthday_greeting") {
      eligible = isBirthdayMatch(row, now);
    } else {
      eligible = isWeekendEligibleBySignupHour(row, now);
    }
    if (!eligible) continue;

    counts.attempted += 1;

    if (!wantsCampaign(row, campaign)) {
      counts.skipped_optout += 1;
      continue;
    }

    const { error: markerErr } = await admin
      .from("notification_campaign_deliveries")
      .insert({
        user_id: row.id,
        campaign_key: campaign,
        period_key: periodKey,
      });

    if (markerErr) {
      if ((markerErr as { code?: string }).code === "23505") {
        counts.skipped_duplicate += 1;
      } else {
        counts.errors += 1;
      }
      continue;
    }

    const { error: notifErr } = await admin.from("notifications").insert({
      user_id: row.id,
      type: campaign,
      title: campaignTitle(campaign),
      body: campaignBody(campaign, row.full_name),
      data: {
        campaign: campaign,
        period_key: periodKey,
      },
    });

    if (notifErr) {
      counts.errors += 1;
      continue;
    }

    counts.inserted += 1;
  }

  return counts;
}

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

  const now = new Date();
  const admin = supabaseAdmin();

  const { data: candidates, error: candidatesErr } = await admin
    .from("profiles")
    .select("id, full_name, birthday_date, created_at, notification_preferences");

  if (candidatesErr) {
    return new Response(JSON.stringify({ error: candidatesErr.message }), {
      status: 500,
      headers: JSON_HDR,
    });
  }

  const rows = (candidates ?? []) as CandidateRow[];
  const birthday = await runCampaign(admin, rows, "birthday_greeting", now);
  const weekend = await runCampaign(admin, rows, "weekend_greeting", now);

  return new Response(
    JSON.stringify({
      ok: true,
      run_date_utc: now.toISOString().slice(0, 10),
      run_hour_utc: now.getUTCHours(),
      birthday,
      weekend,
    }),
    { status: 200, headers: JSON_HDR },
  );
});

