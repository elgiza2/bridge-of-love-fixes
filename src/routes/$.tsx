import { createFileRoute } from "@tanstack/react-router";
import { SpaMount } from "@/lib/spaMount";

// Client-only: the whole Megsy app (its own router included) mounts here.
// Dynamic imports inside `spaMount` keep every app module out of the SSR graph.
export const Route = createFileRoute("/$")({
  ssr: false,
  component: SpaMount,
});
