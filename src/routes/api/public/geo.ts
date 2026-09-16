import { createFileRoute } from "@tanstack/react-router";

/**
 * Visitor country from the edge request headers. Used to pick the local
 * currency shown on pricing when the device timezone/locale lies (VPN, phone
 * set to en-US, etc.). No personal data is returned — just the ISO country.
 */
function countryFromRequest(request: Request): string | null {
  const h = request.headers;
  const candidates = [
    h.get("cf-ipcountry"),
    h.get("x-vercel-ip-country"),
    h.get("x-country-code"),
    h.get("x-geo-country"),
    h.get("fastly-client-country"),
  ];
  for (const c of candidates) {
    if (c && /^[A-Za-z]{2}$/.test(c) && c.toUpperCase() !== "XX") return c.toUpperCase();
  }
  return null;
}

export const Route = createFileRoute("/api/public/geo")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        new Response(JSON.stringify({ country: countryFromRequest(request) }), {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
            "access-control-allow-origin": "*",
          },
        }),
    },
  },
});
