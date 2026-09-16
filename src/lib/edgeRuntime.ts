/**
 * Edge function routing.
 *
 * The heavy endpoints (chat, computer, long runs) can be hosted on a SECOND
 * Supabase account so their CPU/invocation load never touches the project that
 * holds the tables, auth users and storage. Point the app at that compute
 * project with two env vars — leave them unset and everything keeps calling the
 * primary project exactly as before:
 *
 *   VITE_COMPUTE_SUPABASE_URL=https://<compute-ref>.supabase.co
 *   VITE_COMPUTE_SUPABASE_ANON_KEY=<compute anon key>
 *
 * On the compute project the deployed functions need `DATA_SUPABASE_URL`,
 * `DATA_SUPABASE_ANON_KEY` and `DATA_SUPABASE_SERVICE_ROLE_KEY` secrets so they
 * read/write the primary database and verify primary-project JWTs
 * (`supabase/functions/_shared/dataProject.ts`).
 */

/**
 * Fallbacks for hosts that build without the VITE_* env vars (Vercel, a fresh
 * fork). Without them `edgeUrl()` returned a relative "/functions/v1/..." path,
 * which the host answered with its own 404 page — the "Failed to fetch" every
 * computer/chat call hit right after deploying. These are public client values.
 */
const FALLBACK_URL = "https://qdnqxjzjecaieuavagvq.supabase.co";
const FALLBACK_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkbnF4anpqZWNhaWV1YXZhZ3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1MDY1NTcsImV4cCI6MjEwNDA4MjU1N30.eFK_7U7MRlktAAnQQ_9d4k7tF8N3qZ3QGhKVhH6C3Tg";

const PRIMARY_URL =
  String(import.meta.env.VITE_SUPABASE_URL || FALLBACK_URL).replace(/\/$/, "") || FALLBACK_URL;
const PRIMARY_ANON = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || FALLBACK_ANON);

const COMPUTE_URL = String(import.meta.env.VITE_COMPUTE_SUPABASE_URL || "").replace(/\/$/, "");
const COMPUTE_ANON = String(import.meta.env.VITE_COMPUTE_SUPABASE_ANON_KEY || "");

/** Functions that move to the compute account when it is configured. */
const COMPUTE_FUNCTIONS = new Set([
  "chat-alibaba",
  "chat-fast",
  "computer-agent",
  "long-run",
  "deep-research",
  "agent-tick",
]);

/** True when a second Supabase account is configured for compute. */
export const hasComputeProject = Boolean(COMPUTE_URL && COMPUTE_ANON);

function routesToCompute(fn: string): boolean {
  if (!hasComputeProject) return false;
  return COMPUTE_FUNCTIONS.has(fn.split("/")[0]);
}

/** Full URL for an edge function, honouring the compute account. */
export function edgeUrl(fn: string): string {
  const base = routesToCompute(fn) ? COMPUTE_URL : PRIMARY_URL;
  return `${base}/functions/v1/${fn}`;
}

/** Anon key that matches the project the function is deployed to. */
export function edgeAnonKey(fn: string): string {
  return routesToCompute(fn) ? COMPUTE_ANON : PRIMARY_ANON;
}

/**
 * Headers for a direct fetch to an edge function. `token` is the caller's
 * primary-project access token when signed in; guests fall back to the anon key
 * of the hosting project.
 */
export function edgeHeaders(fn: string, token?: string | null): Record<string, string> {
  const apikey = edgeAnonKey(fn);
  return {
    "Content-Type": "application/json",
    apikey,
    Authorization: `Bearer ${token || apikey}`,
  };
}

/**
 * Project URL / anon key with the same fallbacks, for the few modules that build
 * their own function URL instead of calling `edgeUrl()`.
 */
export const SUPABASE_URL = PRIMARY_URL;
export const SUPABASE_ANON_KEY = PRIMARY_ANON;
