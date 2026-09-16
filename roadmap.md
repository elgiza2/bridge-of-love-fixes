# Megsy — roadmap

## Fixed in the QA pass
- Computer tasks: terminal state (done/failed + result text) is written only after the
  external environment confirms it (`src/lib/computer/client.ts`, `persistTerminalState`).
- Browser steps in the agent tool runtime really execute on the cloud computer instead of
  returning a fake `BROWSER_STEP:` string (`src/lib/agentTools/runtime.ts`).
- The agent cannot declare completion while external work is still running
  (`src/lib/agentkernel/kernel.ts`).
- Execution events are no longer chat messages: one status line while running, steps in a
  collapsed list, only the final report as a message.
- Stale `running` computer rows (>10 min) are reconciled once on load
  (`src/lib/computer/taskIndicators.ts`).
- Desktop blank screen: `src/styles/deferred.css` shipped `@tailwind utilities`, emitting an
  unlayered copy of every utility that beat the responsive variants.
- `/` rendered the template placeholder instead of the SPA (`src/routes/index.tsx`).
- Code blocks vanished from answers: `stripLearnBlocks` had an optional fence flag
  (`src/components/chat/ChatMessage.tsx`).
- Image edit follow-ups ("now make the bicycle red") went to the text model and produced
  nothing; they now route to the image pipeline with the previous image as reference
  (`src/lib/media/autoMediaIntent.ts`, `detectImageEditIntent`).
- Cost: the mandatory reviewer round-trip was removed; the higher reviewer runs only when
  self-review finds a real gap.
- Unstyled/broken first paint: every stylesheet was imported from `src/lib/spaBoot.ts`, a
  client-only dynamic chunk, so the server HTML carried no stylesheet. All render-critical
  CSS now lives in `src/styles/app.css`, imported by `src/routes/__root.tsx`, so it ships as
  a `<link>` with the document. Import order preserved.
- Dark flash before the light UI: the boot shell was hard-coded dark while the default theme
  is light. `THEME_BOOT_SCRIPT` in `__root.tsx` resolves the stored theme before first paint
  and `BOOT_STYLE` is theme-aware (auth screens stay dark).
- Dead code: 60 unreachable modules deleted (unused shadcn primitives, `serviceRouter`,
  `intentDetector`, `openManus`, `coderStackBlitz`, `persistentCache`, …), the leftover
  template `src/styles.css` removed, and 26 unused npm packages dropped (antd, recharts,
  `@lobehub/ui`, `@imgly/background-removal`, unused Radix packages, …).
- Visual QA: auth videos now cover every tested viewport, long labels and settings rows wrap,
  the chat composer stays visually stable on focus, and narrow-phone loading no longer goes blank.
- React 19 nested-router warning removed by seeding browser history before React mounts.

## Open
- On mobile, Enter inserts a newline instead of sending; only the Send button sends.
- The Learning mode chip needs horizontal scrolling in the mobile mode bar to be reachable.
- MCP / Integrations and Files were not exercised end to end in this pass.
- [done] Mode chips restyled and made smaller (StarterCards + MobileModeBar).
- No white screen / no loading screen: the site must appear instantly on first paint.

- [done] AdRoll pixel integrated site-wide (lazy load + SPA pageView).

## UI/UX batch 1 (done)
- [done] ScrollToBottomButton restored (was `return null`); wired via ChatMessagesArea, sticky centered, count badge, ar/en aria.
- [done] ChatMessage: removed dead swipe hint/handlers; added Regenerate + Branch actions; ar/en labels for More/Copy/Edit/Like/Dislike/Copied/Download/Resume/interrupted; logical `end-0`/`text-start`; menu `dir` follows UI lang; touch targets 28px -> 36px.
- [done] AppSidebar: chat search input (shown when >5 conversations) filtering titles, with "No matches" state.
- [done] Clean-design pass: scroll-to-bottom button and sidebar search are borderless/transparent with light 1.75-stroke icons; message "More" button lost its hover fill.

## Requests 15 Sep (evening)
- [x] Separate Google sign-up button from email sign-up button (more vertical spacing).
- [x] Keep mobile sidebar/menu toggle on the same side on every page (landing + app pages).
- [x] TikTok Pixel added site-wide; CompletePayment fires only after a verified paid order, with duplicate protection.
- [x] TikTok Events API (server-side) sends the same CompletePayment with a shared event_id; access token stored as a secret, triple duplicate protection.
- [x] Mobile Google and email registration buttons separated with a fixed visible gap.
- [ ] Chips too small -> enlarged; verify visually.
- [ ] Plus menu look rejected -> redesign.
- [ ] Trial offer: show "3 days for $1" in place of $7, auto-renew to $7 after trial.
- [ ] Computer mode "failed to fetch" on production (Vercel) -> route everything through Supabase.
- [ ] Hide Mail (@megsyai.com) across all its pages/entries until redesigned.
- [ ] Arabic wallet/Visa payment sheet looks bad — restyle with design tokens.
- [ ] Arabic visitors: show prices in local currency detected from the device locale/timezone.
- [x] Local currency beside USD prices (device country) — desktop + mobile pricing.
- [x] Facebook-style next-hop prefetch replaces bulk chunk warming; loading fallback removed.
