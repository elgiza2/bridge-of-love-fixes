import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-kashier-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++)
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function buildSignedQuery(data: Record<string, unknown>) {
  const keys = Array.isArray(data.signatureKeys)
    ? (data.signatureKeys as unknown[])
        .filter((key): key is string => typeof key === "string")
        .sort()
    : [];
  if (!keys.length) return null;
  return keys.map((key) => `${key}=${encodeURIComponent(String(data[key] ?? ""))}`).join("&");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const paymentKey = (
    Deno.env.get("KASHIER_API_KEY") ||
    Deno.env.get("KASHIER_PAYMENT_API_KEY") ||
    Deno.env.get("KASHIER_SECRET")
  )?.trim();
  if (!paymentKey) return json({ error: "Kashier is not configured" }, 503);

  let event: Record<string, unknown>;
  try {
    event = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const data = (event.data ?? {}) as Record<string, unknown>;
  const signature = request.headers.get("x-kashier-signature")?.trim() ?? "";
  const signedQuery = buildSignedQuery(data);
  if (!signature || !signedQuery) return json({ error: "missing signature" }, 401);

  const expected = await hmacHex(paymentKey, signedQuery);
  if (!safeEqual(expected.toLowerCase(), signature.toLowerCase())) {
    return json({ error: "invalid signature" }, 401);
  }

  const orderId = String(data.merchantOrderId ?? data.orderId ?? "");
  if (!orderId) return json({ error: "missing order id" }, 400);

  const status = String(data.status ?? "").toUpperCase();
  const nextStatus =
    status === "SUCCESS" || status === "PAID"
      ? "paid"
      : status === "FAILURE" || status === "FAILED" || status === "DECLINED" || status === "REJECT"
        ? "failed"
        : "pending";

  const { data: updated, error } = await admin
    .from("kashier_orders")
    .update({
      status: nextStatus,
      kashier_ref: String(data.transactionId ?? data.kashierOrderId ?? "") || null,
      raw: event,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)
    .eq("status", "pending")
    .select("id, status")
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, order_id: orderId, status: updated?.status ?? "unchanged" });
});
