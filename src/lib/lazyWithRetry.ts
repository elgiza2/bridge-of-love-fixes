import { lazy, ComponentType } from "react";
import { recoverFromChunkLoadError } from "@/lib/chunkRecovery";

const LOAD_TIMEOUT_MS = 30_000;

function withTimeout<T>(factory: () => Promise<T>): Promise<T> {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error("ChunkLoadError: screen module timed out");
      error.name = "ChunkLoadError";
      reject(error);
    }, LOAD_TIMEOUT_MS);
  });
  return Promise.race([factory(), timeout]).finally(() => window.clearTimeout(timer)) as Promise<T>;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(() =>
    withTimeout(factory).catch(async (first) => {
      // A slow connection is far more common than a stale deploy, so retry the
      // import once before falling back to a full reload. Reloading on the
      // first hiccup is what makes the app look like it never finishes loading.
      await new Promise((r) => setTimeout(r, 600));
      try {
        return await withTimeout(factory);
      } catch (error) {
        // Browsers memoize failed module imports, so one guarded reload is the
        // only way to pick up the current HTML and its matching chunks.
        recoverFromChunkLoadError(error ?? first);
        throw error ?? first;
      }
    }),
  );
}
