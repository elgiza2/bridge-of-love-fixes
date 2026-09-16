/**
 * @doc Live USD exchange rates.
 *
 * The pricing page shows a familiar local amount next to the dollar price.
 * Hard-coded rates go stale, so the rate comes from a public feed and is
 * cached in memory for six hours. On any failure the client keeps its own
 * built-in fallback table.
 */
import { createFileRoute } from "@tanstack/react-router";

const TTL_MS = 6 * 60 * 60 * 1000;

let cached: { at: number; rates: Record<string, number> } | null = null;

async function fetchRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (body?.result !== "success" || !body.rates) return null;
    return body.rates;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/fx")({
  server: {
    handlers: {
      GET: async () => {
        if (!cached || Date.now() - cached.at > TTL_MS) {
          const rates = await fetchRates();
          if (rates) cached = { at: Date.now(), rates };
        }
        return new Response(
          JSON.stringify({ base: "USD", rates: cached?.rates ?? null, at: cached?.at ?? null }),
          {
            headers: {
              "content-type": "application/json",
              "cache-control": "public, max-age=3600",
              "access-control-allow-origin": "*",
            },
          },
        );
      },
    },
  },
});
