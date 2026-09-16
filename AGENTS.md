# Megsy — Agent Handbook

Read this before touching anything. It captures the decisions that are easy to
get wrong and expensive to undo.

## 1. What this project is

Megsy AI (megsyai.com) — a React SPA (react-router-dom) that was imported into a
TanStack Start shell so it can be built and hosted on Lovable.

- `src/routes/__root.tsx` — the HTML shell (head, fonts, boot styles, snapshot
  restore, speculation rules). Do not put page UI here.
- `src/routes/$.tsx` — catch-all that mounts the SPA for every non-API path.
- `src/lib/SpaApp.tsx` + `src/lib/spaBoot.ts` — SPA bootstrap (client only).
- `src/App.tsx` + `src/routes-app/*` — the real router, layouts and page tree.
- `src/pages/**`, `src/components/**` — the application itself.
- `src/routes/api/**` — thin TanStack server routes used in local dev only.

Rule: new pages go in `src/pages` and get wired in `src/routes-app/AppRoutes.tsx`.
Do NOT create new files under `src/routes/` except real API endpoints.

## 2. Where the provider keys live (important)

All provider API keys are stored **in the database**, encrypted, in the
`service_keys` table (`key_cipher` + `key_iv`), and they are only ever decrypted
**inside the deployed Supabase Edge Functions**. The app itself never sees a raw
key and must never try to.

Current providers:

| Purpose            | Provider    |
| ------------------ | ----------- |
| Text / chat        | Cerebras    |
| Images + video     | DeAPI, Renderful |
| Computer / agent   | Browser Use |
| Code sandbox       | Freestyle   |

Rotation happens in Postgres via `take_service_key(provider)` (least recently
used, `FOR UPDATE SKIP LOCKED`).

Consequences:

- Chat streams through the Supabase Edge Function (`chat-alibaba`, fast lane
  `chat-fast`). Media goes through `media-image` / `media-video` functions.
- The local `/api/chat` proxy (`src/lib/chat/proxyCore.ts`,
  `src/lib/keys/abliterationKey.ts`) is **off by default**. Enable only for
  offline provider work with `VITE_LOCAL_CHAT_PROXY=1`.
- Never add a provider key to `.env` or to the client bundle.
- Admins can add keys at `/k` (RPC `store_provider_key`, admin-only; counts via
  `provider_key_counts`).

## 3. Backend rules

- External Supabase project `qdnqxjzjecaieuavagvq`. Schema changes go through
  migrations; never edit `src/integrations/supabase/types.ts` by hand.
- Roles live in `user_roles` + `has_role()`. Never trust a client-side role.
- Anything privileged happens in an edge function or a server function, never
  in the browser.

## 4. Front-end rules

- Colors/gradients/shadows come from design tokens in `src/styles.css`. No
  `text-white` / `bg-[#hex]` in components.
- Language is English + Egyptian Arabic (`ar-eg`) via `useUserLang()`. Never
  hard-code Arabic or English strings in a shared component.
- Page snapshots: the pre-hydration snapshot paints into a separate
  `#snapshot-preview` overlay. Never write into `#root` before React hydrates —
  that causes a hydration mismatch.
- SSR safety: browser-only libraries must be imported lazily behind the client
  boot path; read `localStorage` in effects, not during render.

## 5. Checks before shipping

```bash
bunx tsgo --noEmit     # types
bun run build          # production build
```

Then smoke the routes (`/`, `/pricing`, `/chat`, `/settings`, `/usage`,
`/referrals`) signed in, on mobile width and desktop width.

## 6. Known open items

See `roadmap.md`.
