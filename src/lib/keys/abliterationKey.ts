/** @doc Server-only loader for the text-provider (abliteration) API key.
 *  Keys live in the database (`abliteration_keys`, plus the shared
 *  `provider_api_keys` pool with provider "d"). Env vars are only a fallback.
 *
 *  Load is spread evenly across every active key: candidates are ordered by
 *  priority, then least-recently-used, and each use stamps `last_used_at` so the
 *  next request picks a different key. Failures put a key on cooldown (or mark
 *  it exhausted/disabled) so the pool self-heals.
 *  Never import this from client code.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AbliterationKey {
  id: string;
  table: "abliteration_keys" | "provider_api_keys" | "env";
  api_key: string;
  failure_count: number;
}

function envKey(): string {
  return (
    process.env.ABLITERATION_API_KEY ||
    process.env.VITE_ABLITERATION_API_KEY ||
    ""
  ).trim();
}

function adminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Every usable key, best candidate first (priority desc, least-recently-used). */
export async function getAbliterationKeys(): Promise<AbliterationKey[]> {
  const supabase = adminClient();
  type Row = AbliterationKey & { priority: number; last_used_at: string | null; cooling: boolean };
  const rows: Row[] = [];

  if (supabase) {
    const now = Date.now();

    const { data: dedicated } = await supabase
      .from("abliteration_keys")
      .select("id,api_key,priority,last_used_at,cooldown_until,failure_count")
      .eq("status", "active");
    for (const r of (dedicated ?? []) as Array<Record<string, unknown>>) {
      const cd = r.cooldown_until as string | null;
      const api_key = String(r.api_key ?? "").trim();
      if (!api_key) continue;
      rows.push({
        id: String(r.id),
        table: "abliteration_keys",
        api_key,
        failure_count: Number(r.failure_count ?? 0),
        priority: Number(r.priority ?? 0),
        last_used_at: (r.last_used_at as string | null) ?? null,
        cooling: Boolean(cd && new Date(cd).getTime() > now),
      });
    }

    const { data: pool } = await supabase
      .from("provider_api_keys")
      .select("id,api_key,last_used_at,cooldown_until,failure_count")
      .eq("provider", "d")
      .eq("status", "active");
    for (const r of (pool ?? []) as Array<Record<string, unknown>>) {
      const api_key = String(r.api_key ?? "").trim();
      if (!api_key) continue;
      const cd = r.cooldown_until as string | null;
      rows.push({
        id: String(r.id),
        table: "provider_api_keys",
        api_key,
        failure_count: Number(r.failure_count ?? 0),
        priority: 0,
        last_used_at: (r.last_used_at as string | null) ?? null,
        cooling: Boolean(cd && new Date(cd).getTime() > now),
      });
    }

    // Healthy keys first (evenly rotated), keys on cooldown only as a last
    // resort so a single-key setup is never left with nothing to call.
    rows.sort((a, b) => {
      if (a.cooling !== b.cooling) return a.cooling ? 1 : -1;
      if (a.priority !== b.priority) return b.priority - a.priority;
      const ta = a.last_used_at ? new Date(a.last_used_at).getTime() : 0;
      const tb = b.last_used_at ? new Date(b.last_used_at).getTime() : 0;
      return ta - tb;
    });
  }

  const out: AbliterationKey[] = rows.map(({ id, table, api_key, failure_count }) => ({
    id,
    table,
    api_key,
    failure_count,
  }));

  const fallback = envKey();
  if (fallback) out.push({ id: "env", table: "env", api_key: fallback, failure_count: 0 });
  return out;
}

/** Stamp a key as just used so the next request rotates to another one. */
export async function markAbliterationUse(key: AbliterationKey): Promise<void> {
  if (key.table === "env") return;
  const supabase = adminClient();
  if (!supabase) return;
  await supabase
    .from(key.table)
    .update({ last_used_at: new Date().toISOString(), last_error: null })
    .eq("id", key.id);
}

/** Record a failure: cooldown for transient errors, hard status for billing/auth. */
export async function markAbliterationFailure(
  key: AbliterationKey,
  status: number,
  message: string,
  retryAfterSec?: number,
): Promise<void> {
  if (key.table === "env") return;
  const supabase = adminClient();
  if (!supabase) return;
  const patch: Record<string, unknown> = {
    failure_count: key.failure_count + 1,
    last_error: `${status}: ${message}`.slice(0, 500),
  };
  // Only a rejected key is disabled for good. Out-of-credit or rate-limited
  // keys are parked on a cooldown so they rejoin the rotation once topped up.
  if (status === 401) patch.status = "disabled";
  else {
    const seconds =
      status === 402 || status === 403 ? 1800 : status === 429 ? (retryAfterSec ?? 120) : 30;
    patch.cooldown_until = new Date(Date.now() + seconds * 1000).toISOString();
  }
  await supabase.from(key.table).update(patch).eq("id", key.id);
}

/** First usable key (kept for callers that only need a key, e.g. research). */
export async function getAbliterationKey(): Promise<string> {
  const keys = await getAbliterationKeys();
  const picked = keys[0];
  if (!picked) return "";
  await markAbliterationUse(picked);
  return picked.api_key;
}

/** No-op kept for compatibility: keys are no longer cached in memory. */
export function clearAbliterationKeyCache(): void {}
