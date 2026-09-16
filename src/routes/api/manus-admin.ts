import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/manus-admin";

export const Route = createFileRoute("/api/manus-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
