import { supabase } from "../../lib/supabase";

export type CheckoutVerifyItem = {
  id: string;
  title: string;
  image: string;
  quantity: number;
  price: number;
  deliveryFee: number | null;
  fulfillment_type: string;
};

export type CheckoutVerifyShipping = {
  fullName: string;
  phone: string;
  state: string;
  lga: string;
  address: string;
  landmark: string;
};

export type VerifyCheckoutPaymentPayload = {
  payment_reference: string;
  shipping_address: CheckoutVerifyShipping;
  items: CheckoutVerifyItem[];
  p_total_amount: number;
  p_delivery_fee: number;
  p_platform_fee: number;
};

export type VerifyCheckoutPaymentResult = {
  order_id?: string;
  idempotent?: boolean;
  error?: string;
};

export async function verifyCheckoutPayment(payload: VerifyCheckoutPaymentPayload): Promise<VerifyCheckoutPaymentResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { error: "App configuration is incomplete" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { error: "Sign in required" };
  }

  const ref = String(payload.payment_reference ?? "").trim();
  if (!ref) {
    return { error: "Missing payment reference" };
  }

  const res = await fetch(`${supabaseUrl.replace(/\/$/, "")}/functions/v1/verify-checkout-payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      payment_reference: ref,
      shipping_address: payload.shipping_address,
      items: payload.items,
      p_total_amount: payload.p_total_amount,
      p_delivery_fee: payload.p_delivery_fee,
      p_platform_fee: payload.p_platform_fee,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as VerifyCheckoutPaymentResult & { error?: string };
  if (!res.ok) {
    return { error: json.error || "Verification failed" };
  }
  if (!json.order_id) {
    return { error: "No order id returned" };
  }
  return json;
}
