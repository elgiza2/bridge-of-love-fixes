/**
 * Shown when the app bundle cannot be fetched (stale deploy chunk, offline,
 * blocked script). Without it the boot mark pulses forever and the site looks
 * like it never finishes loading.
 */
export function BootFailed() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-lg font-semibold tracking-tight">Couldn't load Megsy</h1>
      <p className="max-w-xs text-sm opacity-70">
        The app files didn't finish downloading. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.removeItem("chunk-reloaded");
          } catch {}
          window.location.reload();
        }}
        className="rounded-full border px-5 py-2 text-sm font-medium"
      >
        Reload
      </button>
    </div>
  );
}

export default BootFailed;
