import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseUserClient } from "../_shared/client.ts";

const JSON_HDR = { ...corsHeaders, "Content-Type": "application/json" };

const TIERS: Record<string, { amountNgn: number; days: number }> = {
  daily: { amountNgn: 500, days: 1 },
  weekly: { amountNgn: 3000, days: 7 },
  monthly: { amountNgn: 10000, days: 30 },
  yearly: { amountNgn: 100000, days: 365 },
};

type VerifyBody = {
  reference?: string;
  product_id?: number | string;
  boost_tier?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: JSON_HDR,
    });
  }

  const secret = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";
  if (!secret) {
    return new Response(JSON.stringify({ error: "Paystack is not configured on the server" }), {
      status: 500,
      headers: JSON_HDR,
    });
  }

  let body: VerifyBody;
  try {
    body = (await req.json()) as VerifyBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: JSON_HDR });
  }

  const reference = String(body.reference ?? "").trim();
  const tier = String(body.boost_tier ?? "").trim().toLowerCase();
  const productIdRaw = body.product_id;
  const productId =
    typeof productIdRaw === "number" && Number.isFinite(productIdRaw)
      ? productIdRaw
      : parseInt(String(productIdRaw ?? ""), 10);

  if (!reference || !TIERS[tier] || !Number.isFinite(productId) || productId < 1) {
    return new Response(JSON.stringify({ error: "reference, product_id, and boost_tier are required" }), {
      status: 400,
      headers: JSON_HDR,
    });
  }

  const userClient = supabaseUserClient(req);
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: JSON_HDR });
  }

  const admin = supabaseAdmin();

  const { data: product, error: prodErr } = await admin
    .from("products")
    .select("id, seller_id, boost_expires_at")
    .eq("id", productId)
    .maybeSingle();

  if (prodErr || !product) {
    return new Response(JSON.stringify({ error: "Product not found" }), { status: 404, headers: JSON_HDR });
  }

  const sellerId = String((product as { seller_id: string }).seller_id);
  if (sellerId !== user.id) {
    return new Response(JSON.stringify({ error: "You do not own this listing" }), { status: 403, headers: JSON_HDR });
  }

  const { data: existing } = await admin
    .from("boost_transactions")
    .select("id, status")
    .eq("payment_reference", reference)
    .maybeSingle();

  if (existing && (existing as { status: string }).status === "success") {
    return new Response(
      JSON.stringify({ ok: true, message: "Already applied", boost_expires_at: null }),
      { status: 200, headers: JSON_HDR },
    );
  }

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const verifyJson = (await verifyRes.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: {
      status?: string;
      amount?: number;
      metadata?: Record<string, unknown>;
    };
  };

  if (!verifyRes.ok || !verifyJson.status) {
    return new Response(
      JSON.stringify({ error: verifyJson.message || "Paystack verification failed" }),
      { status: 400, headers: JSON_HDR },
    );
  }

  const data = verifyJson.data;
  if (!data || data.status !== "success") {
    return new Response(JSON.stringify({ error: "Payment was not successful" }), {
      status: 400,
      headers: JSON_HDR,
    });
  }

  const expectedKobo = TIERS[tier].amountNgn * 100;
  const paid = Number(data.amount);
  if (!Number.isFinite(paid) || paid !== expectedKobo) {
    return new Response(JSON.stringify({ error: "Amount mismatch" }), { status: 400, headers: JSON_HDR });
  }

  const days = TIERS[tier].days;
  const nowIso = new Date().toISOString();

  const { data: row, error: fetchErr } = await admin
    .from("products")
    .select("boost_expires_at, boost_count")
    .eq("id", productId)
    .single();
  if (fetchErr || !row) {
    return new Response(JSON.stringify({ error: "Could not load product" }), { status: 500, headers: JSON_HDR });
  }

  const pr = row as { boost_expires_at: string | null; boost_count: number | null };
  const currentExp = pr.boost_expires_at;
  const base =
    currentExp && new Date(currentExp).getTime() > Date.now()
      ? new Date(currentExp)
      : new Date();
  const newExp = new Date(base.getTime() + days * 86400000);
  const prevCount = Math.max(0, Number(pr.boost_count ?? 0));

  const { error: updErr } = await admin
    .from("products")
    .update({
      boost_expires_at: newExp.toISOString(),
      boost_tier: tier,
      boost_count: prevCount + 1,
      priority_score: 100,
      updated_at: nowIso,
    })
    .eq("id", productId);

  if (updErr) {
    console.error("boost update", updErr);
    return new Response(JSON.stringify({ error: "Could not activate boost" }), { status: 500, headers: JSON_HDR });
  }

  const { error: insErr } = await admin.from("boost_transactions").insert({
    seller_id: user.id,
    product_id: productId,
    amount: TIERS[tier].amountNgn,
    duration_days: days,
    boost_tier: tier,
    payment_reference: reference,
    status: "success",
  });

  if (insErr) {
    console.error("boost_transactions insert", insErr);
    return new Response(JSON.stringify({ error: "Boost applied but logging failed; contact support" }), {
      status: 500,
      headers: JSON_HDR,
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      message: "Boost activated! Your product is now featured.",
      boost_expires_at: newExp.toISOString(),
    }),
    { status: 200, headers: JSON_HDR },
  );
});
