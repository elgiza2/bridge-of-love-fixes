import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/dev-agent";

export const Route = createFileRoute("/api/dev-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
