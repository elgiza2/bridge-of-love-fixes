/**
 * Next-hop prefetching (Facebook style).
 *
 * Instead of warming every page chunk after boot — which saturated a 3G/4G
 * connection and made the current screen feel dead — we warm ONLY the screens
 * the user is most likely to open from where they are standing, one module at a
 * time, while the tab is idle.
 *
 * Result: no loading screens on the paths people actually walk, and no
 * background download storm on a slow connection.
 */

type Loader = () => Promise<unknown>;

/** Screens reachable in one tap from a given screen, most likely first. */
const NEXT_HOPS: Array<{ match: RegExp; hops: Loader[] }> = [
  // Landing / welcome → sign in, then the app itself.
  {
    match: /^\/(welcome)?$/,
    hops: [
      () => import("@/pages/auth/AuthPage"),
      () => import("@/pages/chat/ChatPage"),
    ],
  },
  // Auth → the chat is the only destination after signing in.
  {
    match: /^\/auth(\/|$)/,
    hops: [
      () => import("@/pages/chat/ChatPage"),
      () => import("@/pages/settings/SettingsPage"),
    ],
  },
  // Chat → settings and pricing are the two menu exits.
  {
    match: /^\/chat(\/|$)/,
    hops: [
      () => import("@/pages/settings/SettingsPage"),
      () => import("@/pages/marketing/PricingPage"),
    ],
  },
  // Settings → the data/usage screens people open from the list.
  {
    match: /^\/settings\/?$/,
    hops: [
      () => import("@/pages/settings/DataControlsPage"),
      () => import("@/pages/usage/UsagePage"),
      () => import("@/pages/marketing/PricingPage"),
    ],
  },
  // Pricing → checkout return screens.
  {
    match: /^\/pricing$/,
    hops: [
      () => import("@/pages/billing/BillingPage"),
      () => import("@/pages/auth/AuthPage"),
    ],
  },
];

type Conn = { saveData?: boolean; effectiveType?: string };

/** How many next hops this connection can afford, 0 when it can afford none. */
function budget(): number {
  if (typeof navigator === "undefined") return 0;
  const conn = (navigator as unknown as { connection?: Conn }).connection;
  if (!conn) return 2;
  if (conn.saveData) return 0;
  const type = conn.effectiveType ?? "";
  if (/(^|-)2g$/.test(type)) return 0; // too slow to spend bandwidth ahead
  if (/(^|-)3g$/.test(type)) return 1; // just the single most likely screen
  return 3;
}

const done = new Set<string>();

function whenIdle(fn: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: unknown) => void })
    .requestIdleCallback;
  if (typeof ric === "function") ric(fn, { timeout: 1200 });
  else setTimeout(fn, 200);
}

/**
 * Warm the chunks reachable from `pathname`, sequentially and only while the tab
 * is visible. Safe to call on every navigation — each hop runs once per session.
 */
export function prefetchNextHop(pathname: string): void {
  if (typeof window === "undefined") return;
  const max = budget();
  if (max === 0) return;

  const entry = NEXT_HOPS.find((e) => e.match.test(pathname));
  if (!entry) return;
  const key = entry.match.source;
  if (done.has(key)) return;
  done.add(key);

  const hops = entry.hops.slice(0, max);
  let i = 0;
  const step = () => {
    if (i >= hops.length) return;
    if (document.visibilityState === "hidden") {
      window.setTimeout(step, 2000);
      return;
    }
    void Promise.resolve()
      .then(hops[i++])
      .catch(() => {})
      .then(() => whenIdle(step));
  };
  // Give the current screen room to finish painting and settle first.
  window.setTimeout(() => whenIdle(step), 1200);
}
