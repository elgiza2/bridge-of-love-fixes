import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/read-url";

export const Route = createFileRoute("/api/read-url")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
