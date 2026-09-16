import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/chat";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
