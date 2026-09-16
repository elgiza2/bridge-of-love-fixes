import { createFileRoute } from "@tanstack/react-router";
import { SpaMount } from "@/lib/spaMount";

// The home page is the Megsy SPA itself (same mount as the catch-all `$` route).
export const Route = createFileRoute("/")({
  ssr: false,
  component: SpaMount,
  head: () => ({
    meta: [
      { title: "Megsy AI — Chat, agents and computer use in one workspace" },
      {
        name: "description",
        content:
          "Megsy AI runs real work for you: chat, deep research, images, video, slides, code and a cloud computer agent — in English and Egyptian Arabic.",
      },
      { property: "og:title", content: "Megsy AI — your AI workspace" },
      {
        property: "og:description",
        content:
          "Chat, deep research, images, video, slides, code and a cloud computer agent that actually finishes the task.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Megsy AI — your AI workspace" },
      {
        name: "twitter:description",
        content:
          "Chat, deep research, images, video, slides, code and a cloud computer agent that actually finishes the task.",
      },
    ],
  }),
});
