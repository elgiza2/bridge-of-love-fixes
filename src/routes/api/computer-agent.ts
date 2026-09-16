import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/computer-agent";

export const Route = createFileRoute("/api/computer-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
