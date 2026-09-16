import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

interface CatalogRow {
  tier: string;
  interval: string;
  base_interval: string;
  usd_price: number;
  egp_price: number | null;
  credits: number;
  dodo_product_id: string | null;
  kashier_sku: string | null;
  trial_days: number;
}

/** Same rule the pricing page applies, kept in one place on both sides. */
function catalogSlot(
  interval: "monthly" | "yearly",
  opts: { trial?: boolean; winback?: boolean },
): string {
  if (interval === "yearly") return opts.winback ? "yearly_winback" : "yearly";
  if (opts.trial) return "monthly_trial";
  return opts.winback ? "monthly_winback" : "monthly_intro";
}

async function catalogRow(tier: string, slot: string): Promise<CatalogRow | null> {
  const { data } = await admin
    .from("billing_catalog")
    .select("*")
    .eq("tier", tier)
    .eq("interval", slot)
    .eq("active", true)
    .maybeSingle();
  return (data as CatalogRow | null) ?? null;
}

/** Resolve the row for a choice, falling back to the plain interval row. */
async function resolveRow(
  tier: string,
  interval: "monthly" | "yearly",
  opts: { trial?: boolean; winback?: boolean },
): Promise<CatalogRow | null> {
  const slot = catalogSlot(interval, opts);
  return (await catalogRow(tier, slot)) ?? (await catalogRow(tier, interval));
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const tier = String(payload.tier ?? "pro").toLowerCase();
  const interval: "monthly" | "yearly" =
    String(payload.interval ?? "monthly").toLowerCase() === "yearly" ? "yearly" : "monthly";
  const trial = payload.trial === true || payload.free_trial === true;
  const winback = payload.winback === true || payload.offer === "second_month";
  const provider = String(payload.provider ?? "kashier").toLowerCase();

  // ---- Dodo Payments (global cards) ----------------------------------------
  if (provider === "dodo") {
    const apiKey = (
      Deno.env.get("DODO_PAYMENTS_API_KEY") ||
      Deno.env.get("DODO_API_KEY") ||
      ""
    ).trim();
    if (!apiKey) return json({ error: "Dodo is not configured" }, 503);

    const row = await resolveRow(tier, interval, { trial, winback });
    if (!row) return json({ error: "This plan isn't available yet." }, 400);

    const productId = String(payload.product_id ?? "").trim() || row.dodo_product_id || "";
    if (!productId) {
      return json(
        { error: "This option isn't available for card payment yet. Pick another plan." },
        400,
      );
    }

    const credits = Number(row.credits ?? 0);
    const trialDays = Number(row.trial_days ?? 0);
    const orderId = `dodo_${crypto.randomUUID()}`;
    const site = (Deno.env.get("SITE_URL") || "https://megsyai.com").replace(/\/$/, "");
    const apiBase =
      (Deno.env.get("DODO_MODE") || "live").trim().toLowerCase() === "test"
        ? "https://test.dodopayments.com"
        : "https://live.dodopayments.com";

    const dodoBody: Record<string, unknown> = {
      product_id: productId,
      quantity: 1,
      payment_link: true,
      return_url: `${site}/billing/success?provider=dodo&order=${encodeURIComponent(orderId)}`,
      customer: {
        email: user.email,
        name: (user.user_metadata as Record<string, unknown> | null)?.full_name ?? user.email,
      },
      billing: { city: "Cairo", country: "EG", state: "Cairo", street: "N/A", zipcode: "00000" },
      metadata: {
        order_id: orderId,
        user_id: user.id,
        plan: tier,
        credits: String(credits),
        interval,
        slot: row.interval,
        trial_days: String(trialDays),
      },
    };
    if (trialDays > 0) dodoBody.trial_period_days = trialDays;

    const dodoRes = await fetch(`${apiBase}/subscriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(dodoBody),
    });
    const dodoJson = (await dodoRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!dodoRes.ok) {
      console.error("dodo checkout failed", dodoRes.status, JSON.stringify(dodoJson));
      return json({ error: (dodoJson.message as string) || "Checkout failed" }, 502);
    }
    const url = (dodoJson.payment_link || dodoJson.checkout_url) as string | undefined;
    if (!url) return json({ error: "Checkout failed" }, 502);

    await admin.from("dodo_orders").insert({
      order_id: orderId,
      user_id: user.id,
      plan: tier,
      credits,
      amount: Number(row.usd_price ?? 0),
      currency: "USD",
      status: "pending",
      dodo_payment_id: (dodoJson.payment_id as string) ?? null,
      dodo_subscription_id: (dodoJson.subscription_id as string) ?? null,
      raw: dodoJson,
    });

    return json({
      ok: true,
      url,
      checkout_url: url,
      order_id: orderId,
      product_id: productId,
      slot: row.interval,
      amount: Number(row.usd_price ?? 0),
      currency: "USD",
    });
  }

  // ---- Kashier (Egypt: local cards + mobile wallets) ------------------------
  const method = String(payload.method ?? "card").toLowerCase();
  const display = payload.display === "ar" ? "ar" : "en";
  if (method !== "card" && method !== "wallet")
    return json({ error: "invalid payment method" }, 400);

  // Legacy callers still send a raw sku; new callers send tier + interval.
  const legacySku = String(payload.sku ?? "").trim();
  let row: CatalogRow | null = null;
  if (legacySku) {
    const { data } = await admin
      .from("billing_catalog")
      .select("*")
      .eq("kashier_sku", legacySku)
      .eq("active", true)
      .maybeSingle();
    row = (data as CatalogRow | null) ?? null;
  }
  if (!row) row = await resolveRow(tier, interval, { trial, winback });
  if (!row) return json({ error: "This plan isn't available for local payment yet." }, 400);

  const amount = Number(row.egp_price ?? 0);
  if (!amount || amount <= 0)
    return json({ error: "This plan isn't available for local payment yet." }, 400);

  const merchantId = Deno.env.get("KASHIER_MERCHANT_ID")?.trim();
  const paymentKey = (
    Deno.env.get("KASHIER_API_KEY") ||
    Deno.env.get("KASHIER_PAYMENT_API_KEY") ||
    Deno.env.get("KASHIER_SECRET")
  )?.trim();
  if (!merchantId || !paymentKey) return json({ error: "Kashier is not configured" }, 503);

  const orderId = `ord_${crypto.randomUUID()}`;
  const currency = "EGP";
  const { error: insertError } = await admin.from("kashier_orders").insert({
    order_id: orderId,
    user_id: user.id,
    amount,
    currency,
    credits: Number(row.credits ?? 0),
    plan: row.tier,
    method,
    status: "pending",
    raw: {
      sku: row.kashier_sku,
      slot: row.interval,
      interval: row.base_interval,
      display,
      trial_days: Number(row.trial_days ?? 0),
    },
  });
  if (insertError) return json({ error: insertError.message }, 500);

  const path = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
  const hash = await hmacHex(paymentKey, path);
  const siteUrl = (Deno.env.get("SITE_URL") || "https://megsyai.com").replace(/\/$/, "");
  const redirectUrl = `${siteUrl}/billing/success?provider=kashier&order=${encodeURIComponent(orderId)}`;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) return json({ error: "Payment callback is not configured" }, 503);
  const webhookUrl = `${supabaseUrl}/functions/v1/kashier-webhook`;
  const mode =
    (Deno.env.get("KASHIER_MODE") || "live").trim().toLowerCase() === "test" ? "test" : "live";

  const params = new URLSearchParams({
    merchantId,
    orderId,
    amount: String(amount),
    currency,
    hash,
    mode,
    merchantRedirect: redirectUrl,
    serverWebhook: webhookUrl,
    display,
    // Kashier's hosted page expects the official comma-separated method list.
    allowedMethods: "card,wallet",
  });

  return json({
    ok: true,
    checkout_url: `https://checkout.kashier.io/?${params.toString()}`,
    order_id: orderId,
    amount,
    currency,
    slot: row.interval,
  });
});
