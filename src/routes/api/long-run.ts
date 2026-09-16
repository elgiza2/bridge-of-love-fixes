import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/long-run";

export const Route = createFileRoute("/api/long-run")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
