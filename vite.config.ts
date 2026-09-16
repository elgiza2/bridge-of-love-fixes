// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // On Vercel the server half of the app MUST be built with the vercel preset,
  // otherwise the same-origin edge proxy under /api/public/edge/* is not
  // deployed and every backend call fails with "Failed to fetch" in the
  // browser. Inside Lovable builds this is ignored (the preset is pinned).
  ...(process.env.VERCEL ? { nitro: { preset: "vercel" } as const } : {}),
});
