import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/transcribe";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
