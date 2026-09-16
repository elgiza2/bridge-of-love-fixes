import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/mcp";

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
