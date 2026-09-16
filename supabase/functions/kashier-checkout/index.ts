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

const SKU_TABLE: Record<
  string,
  { plan: string; amount: number; credits: number; trialDays?: number }
> = {
  plan_pro_m_first: { plan: "pro", amount: 249, credits: 1000 },
  plan_pro_m_trial: { plan: "pro", amount: 49, credits: 1000, trialDays: 3 },
  plan_pro_m: { plan: "pro", amount: 499, credits: 1000 },
  plan_elite_m: { plan: "elite", amount: 999, credits: 3000 },
  plan_elite_m_first: { plan: "elite", amount: 499, credits: 3000 },
};

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

  // ---- Dodo Payments (global cards) ----------------------------------------
  // Each plan must resolve to its OWN Dodo product, otherwise every checkout
  // ends up on the same (yearly) price.
  if (String(payload.provider ?? "") === "dodo") {
    const tier = String(payload.tier ?? "pro").toLowerCase();
    const interval =
      String(payload.interval ?? "monthly").toLowerCase() === "yearly" ? "yearly" : "monthly";
    const trial = payload.trial === true || payload.free_trial === true;
    const winback = payload.winback === true || payload.offer === "second_month";

    const slot =
      interval === "yearly"
        ? winback
          ? "yearly_winback"
          : "yearly"
        : winback
          ? "monthly_winback"
          : "monthly_intro";

    const apiKey = (
      Deno.env.get("DODO_PAYMENTS_API_KEY") ||
      Deno.env.get("DODO_API_KEY") ||
      ""
    ).trim();
    if (!apiKey) return json({ error: "Dodo is not configured" }, 503);

    const trialProduct = (Deno.env.get("DODO_TRIAL_PRODUCT_ID") || "").trim();
    let productId = String(payload.product_id ?? "").trim();
    if (trial && trialProduct) productId = trialProduct;
    if (!productId) {
      const { data: productRow } = await admin
        .from("dodo_products")
        .select("product_id")
        .eq("tier", tier)
        .eq("interval", slot)
        .eq("active", true)
        .maybeSingle();
      productId = productRow?.product_id ?? "";
    }
    if (!productId) {
      const { data: fallbackRow } = await admin
        .from("dodo_products")
        .select("product_id")
        .eq("tier", tier)
        .eq("interval", interval)
        .eq("active", true)
        .maybeSingle();
      productId = fallbackRow?.product_id ?? "";
    }
    if (!productId) return json({ error: "This plan isn't available yet." }, 400);

    const baseCredits = tier === "elite" ? 3000 : 1000;
    const credits = interval === "yearly" ? baseCredits * 12 : baseCredits;
    const trialDays = trial && !trialProduct ? 3 : 0;
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
        slot,
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

    const pretax = Number(dodoJson.recurring_pre_tax_amount ?? 0);
    await admin.from("dodo_orders").insert({
      order_id: orderId,
      user_id: user.id,
      plan: tier,
      credits,
      amount: Number.isFinite(pretax) ? pretax / 100 : 0,
      currency: "USD",
      status: "pending",
      dodo_payment_id: (dodoJson.payment_id as string) ?? null,
      dodo_subscription_id: (dodoJson.subscription_id as string) ?? null,
      raw: dodoJson,
    });

    return json({ ok: true, url, checkout_url: url, order_id: orderId, product_id: productId });
  }

  const sku = String(payload.sku ?? "");
  const method = String(payload.method ?? "card").toLowerCase();
  const offer = payload.offer ? String(payload.offer) : null;
  const display = payload.display === "ar" ? "ar" : "en";
  const skuInfo = SKU_TABLE[sku];
  if (!skuInfo) return json({ error: "unknown sku" }, 400);
  if (method !== "card" && method !== "wallet")
    return json({ error: "invalid payment method" }, 400);

  const merchantId = Deno.env.get("KASHIER_MERCHANT_ID")?.trim();
  const paymentKey = (
    Deno.env.get("KASHIER_API_KEY") ||
    Deno.env.get("KASHIER_PAYMENT_API_KEY") ||
    Deno.env.get("KASHIER_SECRET")
  )?.trim();
  if (!merchantId || !paymentKey) return json({ error: "Kashier is not configured" }, 503);

  const orderId = `ord_${crypto.randomUUID()}`;
  const currency = "EGP";
  const amount = skuInfo.amount;
  const { error: insertError } = await admin.from("kashier_orders").insert({
    order_id: orderId,
    user_id: user.id,
    amount,
    currency,
    credits: skuInfo.credits,
    plan: skuInfo.plan,
    method,
    status: "pending",
    raw: { sku, offer, display, trial_days: skuInfo.trialDays ?? 0 },
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
    // The selected method is carried as a UI preference; Kashier may still
    // show the other enabled method, which avoids the phone-step 403 seen when
    // a single unsupported method is forced into the legacy HPP URL.
    allowedMethods: "card,wallet",
  });

  return json({
    ok: true,
    checkout_url: `https://checkout.kashier.io/?${params.toString()}`,
    order_id: orderId,
  });
});
