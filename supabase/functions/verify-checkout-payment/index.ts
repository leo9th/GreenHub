import { corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, supabaseUserClient } from "../_shared/client.ts";

const JSON_HDR = { ...corsHeaders, "Content-Type": "application/json" };

type ShippingAddress = {
  fullName?: string;
  phone?: string;
  state?: string;
  lga?: string;
  address?: string;
  landmark?: string;
};

type CheckoutItem = {
  id?: string;
  title?: string;
  image?: string | null;
  quantity?: number;
  price?: number;
  deliveryFee?: number | null;
  fulfillment_type?: string;
};

type VerifyBody = {
  payment_reference?: string;
  shipping_address?: ShippingAddress;
  items?: CheckoutItem[];
  p_total_amount?: number;
  p_delivery_fee?: number;
  p_platform_fee?: number;
};

function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

async function fetchOrderIdByReference(admin: ReturnType<typeof supabaseAdmin>, buyerId: string, reference: string) {
  const { data, error } = await admin
    .from("orders")
    .select("id")
    .eq("payment_reference", reference)
    .eq("buyer_id", buyerId)
    .maybeSingle();
  if (error) {
    console.error("orders lookup by payment_reference", error);
    return null;
  }
  const row = data as { id: string } | null;
  return row?.id ?? null;
}

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

  const reference = String(body.payment_reference ?? "").trim();
  if (!reference || reference.length > 256) {
    return new Response(JSON.stringify({ error: "payment_reference is required" }), {
      status: 400,
      headers: JSON_HDR,
    });
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: "items must be a non-empty array" }), {
      status: 400,
      headers: JSON_HDR,
    });
  }

  if (!body.shipping_address || typeof body.shipping_address !== "object") {
    return new Response(JSON.stringify({ error: "shipping_address is required" }), { status: 400, headers: JSON_HDR });
  }

  const total = body.p_total_amount;
  const delivery = body.p_delivery_fee;
  const platform = body.p_platform_fee;
  if (!isFiniteNum(total) || total < 0 || !isFiniteNum(delivery) || delivery < 0 || !isFiniteNum(platform) || platform < 0) {
    return new Response(JSON.stringify({ error: "Invalid fee or total amounts" }), { status: 400, headers: JSON_HDR });
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
  const existingId = await fetchOrderIdByReference(admin, user.id, reference);
  if (existingId) {
    return new Response(JSON.stringify({ order_id: existingId, idempotent: true }), { status: 200, headers: JSON_HDR });
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
      currency?: string;
    };
  };

  if (!verifyRes.ok || !verifyJson.status) {
    return new Response(
      JSON.stringify({ error: verifyJson.message || "Paystack verification failed" }),
      { status: 400, headers: JSON_HDR },
    );
  }

  const pdata = verifyJson.data;
  if (!pdata || pdata.status !== "success") {
    return new Response(JSON.stringify({ error: "Payment was not successful" }), {
      status: 400,
      headers: JSON_HDR,
    });
  }

  const paidKobo = Number(pdata.amount);
  if (!Number.isFinite(paidKobo) || paidKobo < 0) {
    return new Response(JSON.stringify({ error: "Invalid Paystack amount" }), { status: 400, headers: JSON_HDR });
  }

  const currency = String(pdata.currency ?? "").toUpperCase();
  if (currency && currency !== "NGN") {
    return new Response(JSON.stringify({ error: "Unsupported currency" }), { status: 400, headers: JSON_HDR });
  }

  const expectedKobo = Math.round(total * 100);
  if (paidKobo !== expectedKobo) {
    return new Response(
      JSON.stringify({
        error: "Order total does not match verified Paystack amount. Refresh checkout and try again, or contact support.",
      }),
      { status: 400, headers: JSON_HDR },
    );
  }

  const rpcArgs = {
    p_shipping_address: body.shipping_address,
    p_items: items,
    p_total_amount: total,
    p_delivery_fee: delivery,
    p_platform_fee: platform,
    p_order_status: "paid",
    p_payment_reference: reference,
    p_payment_method: "paystack",
  };

  const { data: rpcData, error: rpcErr } = await userClient.rpc("create_checkout_order", rpcArgs);

  if (!rpcErr) {
    const orderId = typeof rpcData === "string" ? rpcData : null;
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Checkout completed without a valid order id" }), {
        status: 500,
        headers: JSON_HDR,
      });
    }
    return new Response(JSON.stringify({ order_id: orderId }), { status: 200, headers: JSON_HDR });
  }

  const msg = String(rpcErr.message ?? "");
  const code = (rpcErr as { code?: string }).code ?? "";
  const isDup =
    code === "23505" ||
    msg.includes("duplicate key") ||
    msg.includes("orders_payment_reference") ||
    msg.includes("payment_reference");

  if (isDup) {
    const afterDup = await fetchOrderIdByReference(admin, user.id, reference);
    if (afterDup) {
      return new Response(JSON.stringify({ order_id: afterDup, idempotent: true }), { status: 200, headers: JSON_HDR });
    }
  }

  console.error("create_checkout_order rpc", rpcErr);
  return new Response(JSON.stringify({ error: msg || "Could not create order" }), { status: 500, headers: JSON_HDR });
});
