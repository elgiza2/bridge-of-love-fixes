import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/anything";

export const Route = createFileRoute("/api/anything")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
