import { Suspense, lazy, useEffect, useState } from "react";
import { BootFailed } from "@/components/common/BootFailed";

/**
 * Shared client mount for the Megsy SPA, used by both "/" and the "/$"
 * catch-all so the boot path is identical everywhere.
 *
 * Why the imports start at module scope: the boot side effects and the app
 * tree used to be fetched one after the other (boot → then the app chunk),
 * which meant two network round trips of blank screen before anything
 * painted. Kicking both off as soon as this module evaluates downloads them
 * in parallel, while the app tree still waits for boot to finish before it
 * renders, so ordering is unchanged.
 */
function loadChunk<T>(load: () => Promise<T>): Promise<T> {
  return load().catch(async (err) => {
    await new Promise((r) => setTimeout(r, 400));
    try {
      return await load();
    } catch {
      if (typeof window !== "undefined" && !sessionStorage.getItem("chunk-reloaded")) {
        sessionStorage.setItem("chunk-reloaded", "1");
        window.location.reload();
      }
      throw err;
    }
  });
}

const isClient = typeof window !== "undefined";
const bootPromise = isClient ? loadChunk(() => import("@/lib/spaBoot")) : null;
const appPromise = isClient ? loadChunk(() => import("@/lib/SpaApp")) : null;

const SpaAppLazy = lazy(async () => {
  await (bootPromise ?? loadChunk(() => import("@/lib/spaBoot")));
  return (appPromise ?? loadChunk(() => import("@/lib/SpaApp"))) as Promise<{
    default: React.ComponentType;
  }>;
});

export function SpaMount() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([bootPromise, appPromise]).catch(() => {
      // Never leave the screen stuck on the boot mark: surface a retry.
      if (!cancelled) setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return <BootFailed />;
  return (
    <Suspense fallback={null}>
      <SpaAppLazy />
    </Suspense>
  );
}
