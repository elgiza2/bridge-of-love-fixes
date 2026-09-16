import { supabase } from "@/integrations/supabase/client";

const TIKTOK_PIXEL_ID = "DAKS6DRC77UES9754TBG";

type TikTokQueue = Array<unknown> & {
  load?: (pixelId: string) => void;
  page?: () => void;
  track?: (
    event: string,
    properties?: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => void;
  methods?: string[];
  setAndDefer?: (queue: TikTokQueue, method: string) => void;
  instance?: (pixelId: string) => TikTokQueue;
  _i?: Record<string, TikTokQueue>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
  _u?: string;
};

declare global {
  interface Window {
    TiktokAnalyticsObject?: string;
    ttq?: TikTokQueue;
  }
}

export function loadTikTokPixel() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.ttq?.load) return;

  const queue = (window.ttq = window.ttq || ([] as unknown as TikTokQueue));
  window.TiktokAnalyticsObject = "ttq";
  queue.methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
    "holdConsent",
    "revokeConsent",
    "grantConsent",
  ];
  queue.setAndDefer = (target, method) => {
    (target as unknown as Record<string, (...args: unknown[]) => void>)[method] = (...args) => {
      target.push([method, ...args]);
    };
  };
  for (const method of queue.methods) queue.setAndDefer(queue, method);
  queue.instance = (pixelId) => {
    const instance = queue._i?.[pixelId] || ([] as unknown as TikTokQueue);
    for (const method of queue.methods || []) queue.setAndDefer?.(instance, method);
    return instance;
  };
  queue.load = (pixelId) => {
    const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
    queue._i = queue._i || {};
    queue._i[pixelId] = [] as unknown as TikTokQueue;
    queue._i[pixelId]._u = src;
    queue._t = queue._t || {};
    queue._t[pixelId] = Date.now();
    queue._o = queue._o || {};
    queue._o[pixelId] = {};
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.async = true;
    script.src = `${src}?sdkid=${encodeURIComponent(pixelId)}&lib=ttq`;
    document.head.appendChild(script);
  };

  queue.load(TIKTOK_PIXEL_ID);
  queue.page?.();
}

type CompletePayment = {
  paymentId: string;
  value?: number;
  currency?: string;
  productName?: string;
};

export function trackTikTokCompletePayment({
  paymentId,
  value,
  currency,
  productName,
}: CompletePayment) {
  if (typeof window === "undefined" || !paymentId) return;

  // The browser copy is guarded per tab; the server copy is retried until
  // Supabase confirms success. A permanent guard before the server response
  // would lose the conversion forever when Events API or the network fails.
  const pixelStorageKey = `megsy_tiktok_pixel_purchase:${paymentId}`;
  const serverStorageKey = `megsy_tiktok_server_purchase:${paymentId}`;
  let pixelAlreadyFired = firedPayments.has(paymentId);
  try {
    pixelAlreadyFired = pixelAlreadyFired || window.sessionStorage.getItem(pixelStorageKey) === "1";
  } catch {}

  const properties: Record<string, unknown> = {
    content_type: "product",
    content_id: paymentId,
    quantity: 1,
  };
  if (productName) properties.content_name = productName;
  if (typeof value === "number" && Number.isFinite(value)) properties.value = value;
  if (currency) properties.currency = currency.toUpperCase();

  if (!pixelAlreadyFired) {
    firedPayments.add(paymentId);
    loadTikTokPixel();
    window.ttq?.track?.("CompletePayment", properties, { event_id: paymentId });
    try {
      window.sessionStorage.setItem(pixelStorageKey, "1");
    } catch {}
  }

  // Server-side copy through Supabase Edge Functions — same event_id, so
  // TikTok deduplicates the browser and server copies.
  let serverAlreadySent = false;
  try {
    serverAlreadySent = window.localStorage.getItem(serverStorageKey) === "1";
  } catch {}
  if (serverAlreadySent) return;

  void supabase.auth.getUser().then(({ data: { user } }) =>
    supabase.functions
      .invoke("tiktok-purchase", {
        body: {
          eventId: paymentId,
          value: typeof value === "number" && Number.isFinite(value) ? value : undefined,
          currency: currency ? currency.toUpperCase() : undefined,
          productName: productName || undefined,
          url: window.location.href,
          referrer: document.referrer || undefined,
          userAgent: navigator.userAgent,
          email: user?.email || undefined,
          externalId: user?.id || undefined,
          ttclid: readCookie("ttclid") || undefined,
          ttp: readCookie("_ttp") || undefined,
        },
      })
      .then(({ data, error }) => {
        if (!error && data?.ok) {
          try {
            window.localStorage.setItem(serverStorageKey, "1");
          } catch {}
        }
      })
      .catch(() => undefined),
  );
}

const firedPayments = new Set<string>();

function readCookie(name: string) {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
