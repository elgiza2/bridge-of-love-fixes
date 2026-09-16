import { createFileRoute } from "@tanstack/react-router";
import handler from "@/lib/apiHandlers/manus-admin";

export const Route = createFileRoute("/api/dev-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        url.searchParams.set("provider", "freestyle");
        return handler(new Request(url.toString(), request));
      },
      OPTIONS: async ({ request }) => handler(request),
    },
  },
});
