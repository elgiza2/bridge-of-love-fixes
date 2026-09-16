const TIKTOK_PIXEL_ID = "DAKS6DRC77UES9754TBG";
const TIKTOK_ENDPOINT = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PurchasePayload = {
  eventId: string;
  value?: number;
  currency?: string;
  productName?: string;
  url?: string;
  referrer?: string;
  userAgent?: string;
  ttclid?: string;
  ttp?: string;
  email?: string;
  externalId?: string;
};

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);

  const token = Deno.env.get("TIKTOK_EVENTS_ACCESS_TOKEN")?.trim();
  if (!token) return json({ ok: false, reason: "missing_token" }, 503);

  let data: PurchasePayload;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, reason: "invalid_json" }, 400);
  }

  if (!data.eventId || typeof data.eventId !== "string" || data.eventId.length > 200) {
    return json({ ok: false, reason: "invalid_event_id" }, 400);
  }
  if (data.value !== undefined && (!Number.isFinite(data.value) || data.value < 0)) {
    return json({ ok: false, reason: "invalid_value" }, 400);
  }

  const user: Record<string, string> = {};
  if (data.userAgent) user.user_agent = data.userAgent;
  if (data.ttclid) user.ttclid = data.ttclid;
  if (data.ttp) user.ttp = data.ttp;
  if (data.email) user.email = await sha256(data.email);
  if (data.externalId) user.external_id = await sha256(data.externalId);

  const properties: Record<string, unknown> = {
    content_type: "product",
    contents: [
      {
        content_id: data.eventId,
        content_name: data.productName,
        quantity: 1,
        price: data.value,
      },
    ],
  };
  if (data.value !== undefined) properties.value = data.value;
  if (data.currency) properties.currency = data.currency.toUpperCase();

  const response = await fetch(TIKTOK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": token },
    body: JSON.stringify({
      event_source: "web",
      event_source_id: TIKTOK_PIXEL_ID,
      data: [
        {
          event: "CompletePayment",
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.eventId,
          user,
          properties,
          page: data.url ? { url: data.url, referrer: data.referrer } : undefined,
        },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`TikTok Events API failed [${response.status}]: ${text}`);
    return json({ ok: false, reason: "tiktok_http_error" }, 502);
  }

  try {
    const result = JSON.parse(text) as { code?: number; message?: string };
    if (result.code && result.code !== 0) {
      console.error(`TikTok Events API rejected event: ${text}`);
      return json({ ok: false, reason: "tiktok_rejected" }, 502);
    }
  } catch {
    return json({ ok: false, reason: "invalid_tiktok_response" }, 502);
  }

  return json({ ok: true });
});
