import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import "../styles/app.css";
import { reportLovableError } from "../lib/lovable-error-reporting";

// First-paint colours match the stored theme. Do not render a fake app frame
// here: on a slow or interrupted connection it looks like an endless loader.
const BOOT_STYLE = `
:root { color-scheme: light; }
html, body { background-color: #f3f3f5; margin: 0; }
#root { min-height: 100dvh; background-color: #f3f3f5; }
html[data-theme="dark"] { color-scheme: dark; }
html[data-theme="dark"], html[data-theme="dark"] body { background-color: #1c1c1c; }
html[data-theme="dark"] #root { background-color: #1c1c1c; }
#root[data-snapshot-preview="true"] { pointer-events: none; user-select: none; contain: paint; }
`;

const THEME_BOOT_SCRIPT = `
(function(){try{
  var p=location.pathname;
  var auth=["/auth","/login","/signin","/sign-in","/signup","/sign-up","/register","/reset-password"]
    .some(function(a){return p===a||p.indexOf(a+"/")===0;});
  var m=localStorage.getItem("megsy_theme");
  if(m!=="dark"&&m!=="light"&&m!=="system") m="light";
  var t=auth?"dark":(m==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m);
  var h=document.documentElement;
  h.setAttribute("data-theme",t);
  h.classList.toggle("dark",t==="dark");
  h.classList.toggle("light",t==="light");
  h.style.colorScheme=t;
}catch(e){}})();
`;

const GARAMOND_STYLE = `
@font-face {
  font-family: "ITC Garamond Std Narrow"; font-weight: 300; font-style: normal; font-display: swap;
  src: url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-LtNarrow_i2zcip.woff2") format("woff2"),
       url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-LtNarrow_soc5vc.woff") format("woff");
}
@font-face {
  font-family: "ITC Garamond Std Narrow"; font-weight: 400; font-style: normal; font-display: swap;
  src: url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrow_xjfoc0.woff2") format("woff2"),
       url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrow_xjfoc0.woff") format("woff");
}
@font-face {
  font-family: "ITC Garamond Std Narrow"; font-weight: 400; font-style: italic; font-display: swap;
  src: url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrowIta_hiy9ld.woff2") format("woff2"),
       url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrowIta_rlarxo.woff") format("woff");
}
@font-face {
  font-family: "ITC Garamond Std Narrow"; font-weight: 500; font-style: normal; font-display: swap;
  src: url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrow_xjfoc0.woff2") format("woff2"),
       url("https://res.cloudinary.com/dgupuutfn/raw/upload/v1783596334/ITCGaramondStd-BkNarrow_xjfoc0.woff") format("woff");
}
`;

const TELEGRAM_SCRIPT = `(function () {
  try {
    var inTelegram =
      /[?#&]tgWebApp/.test(location.href) ||
      "TelegramWebviewProxy" in window ||
      /Telegram/i.test(navigator.userAgent);
    if (!inTelegram) return;
    document.write('<script src="https://telegram.org/js/telegram-web-app.js"><\\/script>');
  } catch (e) {}
})();`;

const DEFERRED_FONTS_SCRIPT = `(function () {
  var HREF =
    "https://fonts.googleapis.com/css2?family=Inter:wght@700&family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&family=DM+Sans:wght@400;500;600;700&family=Noto+Serif+Arabic:wght@400;600;700&family=Almarai:wght@300;400;700;800&family=Cairo:wght@400;500;600;700&family=Tajawal:wght@400;500;700&family=Readex+Pro:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Sora:wght@400;500;600;700;800&family=Archivo+Black&family=Manrope:wght@400;500;600;700&display=swap";
  var EXTRA =
    "https://db.onlinewebfonts.com/c/e66905e07608167a84e6ad52f638c3c6?family=Helvetica+Now+Var";
  function add(href) {
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }
  function go() {
    try {
      var c = navigator.connection || {};
      if (c.saveData) return;
      if (/2g/.test(c.effectiveType || "")) return;
    } catch (e) {}
    var run = function () { add(HREF); add(EXTRA); };
    if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 800);
  }
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
})();`;

const SNAPSHOT_RESTORE_SCRIPT = `(function () {
  try {
    var p = (location.pathname || "/").split(/[?#]/)[0].replace(/\\/+$/, "") || "/";
    var deny = [
      "/auth","/login","/signin","/signup","/register","/oauth","/chat","/settings",
      "/billing","/workspace","/library","/integrations","/agent","/apps","/mfa","/2fa",
      "/reset-password","/change-password","/change-email","/delete-account",
      "/accept-invite","/switch-account"
    ];
    for (var i = 0; i < deny.length; i++) {
      if (p === deny[i] || p.indexOf(deny[i] + "/") === 0) return;
    }
    var key = "megsy:pagesnap:v1:" + p;
    var raw = localStorage.getItem(key);
    if (!raw) return;
    var e = JSON.parse(raw);
    if (!e || typeof e.html !== "string" || typeof e.sum !== "number") return;
    var meta = document.querySelector('meta[name="megsy-build"]');
    var build = meta ? meta.getAttribute("content") : "";
    if (!build || build.indexOf("%") >= 0) {
      build = "d_" + Math.floor(Date.now() / 86400000);
    }
    if (e.build !== build) { localStorage.removeItem(key); return; }
    if (Date.now() - e.ts > 604800000) { localStorage.removeItem(key); return; }
    var src = e.html + "|" + e.build;
    var h = 0x811c9dc5;
    for (var j = 0; j < src.length; j++) {
      h ^= src.charCodeAt(j);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    if ((h >>> 0) !== e.sum) { localStorage.removeItem(key); return; }
    var tpl = document.createElement("template");
    tpl.innerHTML = e.html;
    tpl.content.querySelectorAll("script,iframe,object,embed,link,meta").forEach(function (el) { el.remove(); });
    var blocked = { href: 1, src: 1, "xlink:href": 1, formaction: 1, poster: 1 };
    tpl.content.querySelectorAll("*").forEach(function (el) {
      for (var a = el.attributes.length - 1; a >= 0; a--) {
        var n = el.attributes[a].name.toLowerCase();
        var v = (el.attributes[a].value || "").trim().toLowerCase();
        if (n.indexOf("on") === 0 || (blocked[n] && v.indexOf("javascript:") === 0)) {
          el.removeAttribute(el.attributes[a].name);
        }
      }
    });
    // The snapshot is painted in its own overlay element — never inside #root,
    // which React hydrates (mutating it before hydration breaks the match).
    var layer = document.createElement("div");
    layer.id = "snapshot-preview";
    layer.setAttribute("aria-busy", "true");
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = "position:fixed;inset:0;z-index:2147483000;overflow:hidden;background:var(--background,#0b0b0c)";
    layer.appendChild(tpl.content);
    document.body.appendChild(layer);
    // Safety net: if the app never mounts (stale chunk, slow network, script
    // error) this overlay would otherwise sit on screen forever and look like
    // an endless load. Drop it after a short grace period no matter what.
    setTimeout(function () {
      var el = document.getElementById("snapshot-preview");
      if (el) el.remove();
    }, 4000);
  } catch (err) {}
})();`;

const SPECULATION_SCRIPT = `(function () {
  try {
    var nav = navigator;
    var c = nav.connection || {};
    var slow = c.saveData === true || /(^|-)(2g|slow-2g)$/.test(c.effectiveType || "");
    var weak = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4;
    if (slow || weak) return;
    var add = function () {
      var s = document.createElement("script");
      s.type = "speculationrules";
      s.textContent = JSON.stringify({
        prerender: [
          {
            source: "document",
            where: {
              and: [
                { href_matches: "/*" },
                { not: { href_matches: "/api/*" } },
                { not: { href_matches: "/auth/*" } },
              ],
            },
            eagerness: "moderate",
          },
        ],
        prefetch: [
          { source: "document", where: { href_matches: "/*" }, eagerness: "conservative" },
        ],
      });
      document.body.appendChild(s);
    };
    if (document.readyState === "complete") setTimeout(add, 1200);
    else addEventListener("load", function () { setTimeout(add, 1200); });
  } catch (e) {}
})();`;

const ORG_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Megsy AI",
  url: "https://megsyai.com/",
  logo: "https://megsyai.com/app-icon-512.png",
  sameAs: ["https://x.com/megsyai", "https://www.instagram.com/megsyai"],
  description:
    "All-in-one AI platform for chat, images, video, slides, docs and apps — every top model in one place.",
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm opacity-70">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm opacity-70">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { name: "google", content: "notranslate" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Megsy" },
      { name: "application-name", content: "Megsy AI" },
      { name: "theme-color", content: "#ffffff" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "format-detection", content: "telephone=no" },
      { title: "Megsy AI — All-in-One AI Platform for Chat, Images & Video" },
      {
        name: "description",
        content:
          "Chat, generate images, create videos, build slides, docs and full apps — one AI platform with every top model. Free to start.",
      },
      { property: "og:title", content: "Megsy AI — All-in-One AI Platform for Chat, Images & Video" },
      {
        property: "og:description",
        content:
          "Chat, generate images, create videos, build slides, docs and full apps — one AI platform with every top model. Free to start.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://megsyai.com/" },
      { property: "og:site_name", content: "Megsy AI" },
      { property: "og:locale", content: "en_US" },
      { property: "og:locale:alternate", content: "ar_EG" },
      { property: "og:image", content: "https://megsyai.com/og-megsy.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Megsy AI — All-in-One AI Platform" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://megsyai.com/og-megsy.jpg" },
    ],
    links: [
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/app-icon-32.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/app-icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/app-icon-512.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/app-icon-180.png" },
      { rel: "manifest", href: "/site.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://qdnqxjzjecaieuavagvq.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://qdnqxjzjecaieuavagvq.supabase.co" },
      { rel: "preconnect", href: "https://d8j0ntlcm91z4.cloudfront.net", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://d8j0ntlcm91z4.cloudfront.net" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// AdRoll retargeting pixel. Loaded lazily after the app is interactive so the
// third-party request never competes with the first paint, and re-fired on SPA
// navigation because the loader only counts one pageView per document.
const ADROLL_SCRIPT = `
(function(){
  var start = function(){
    var w = window, d = document;
    w.adroll_adv_id = "U7L76NUFIBDU5JJZWFGSPY";
    w.adroll_pix_id = "YH6HQKQYMVBAFP6KK4M5WU";
    w.adroll_version = "2.0";
    w.adroll_tag_source = w.adroll_tag_source || "manual";
    w.__adroll_loaded = true;
    w.adroll = w.adroll || [];
    w.adroll.f = ['setProperties','identify','track','identify_email','get_cookie'];
    for (var a = 0; a < w.adroll.f.length; a++) {
      w.adroll[w.adroll.f[a]] = w.adroll[w.adroll.f[a]] || (function(n){
        return function(){ w.adroll.push([n, arguments]); };
      })(w.adroll.f[a]);
    }
    var e = d.createElement('script');
    var o = d.getElementsByTagName('script')[0];
    e.async = 1;
    e.src = "https://s.adroll.com/j/" + w.adroll_adv_id + "/roundtrip.js";
    o.parentNode.insertBefore(e, o);
    w.adroll.track("pageView");
    var last = location.pathname;
    var onNav = function(){
      if (location.pathname === last) return;
      last = location.pathname;
      try { w.adroll.track("pageView"); } catch (err) {}
    };
    w.addEventListener("megsy:navigation", onNav);
    w.addEventListener("popstate", onNav);
  };
  if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 2500);
})();
`;


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" className="dark" translate="no" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: BOOT_STYLE }} />
        <style dangerouslySetInnerHTML={{ __html: GARAMOND_STYLE }} />
        <script dangerouslySetInnerHTML={{ __html: TELEGRAM_SCRIPT }} />
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: DEFERRED_FONTS_SCRIPT }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ORG_JSON_LD }} />
      </head>
      <body>
        <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <filter id="megsy-glass-warp" x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.008 0.014"
                numOctaves="2"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="28"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
        <div id="root">
          {children}
        </div>
        <script dangerouslySetInnerHTML={{ __html: SNAPSHOT_RESTORE_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SPECULATION_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ADROLL_SCRIPT }} />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
