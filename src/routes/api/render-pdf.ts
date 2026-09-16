import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/render-pdf";

export const Route = createFileRoute("/api/render-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => handler(request),
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
