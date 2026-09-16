/**
 * @doc Sends the browser to a hosted checkout page.
 *
 * `window.location.href` alone is not enough: inside an embedded frame (the
 * Lovable preview, an in-app webview, an embed of the site) the checkout host
 * refuses to render in a frame, so the tap looks like it did nothing. We escape
 * the frame first, then fall back to a new tab, then to a same-frame navigation.
 */
export function openCheckoutUrl(url: string): boolean {
  if (typeof window === "undefined" || !url) return false;

  const framed = window.top && window.top !== window;
  if (framed) {
    try {
      // Allowed when the embedder permits top-level navigation.
      window.top!.location.href = url;
      return true;
    } catch {
      /* cross-origin or sandboxed — fall through */
    }
    const tab = window.open(url, "_blank", "noopener,noreferrer");
    if (tab) return true;
  }

  window.location.href = url;
  return true;
}
