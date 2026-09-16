import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/web-search";

export const Route = createFileRoute("/api/web-search")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
