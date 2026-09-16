/** @doc Credits: daily allowance, live balance and consumption — real data only.
 *
 *  Server side owns everything:
 *  - `claim_daily_credits()` tops the balance up to the plan's daily allowance,
 *    once per calendar day, and writes the grant into the credit history.
 *  - `get_credit_overview()` returns balance, plan, allowance, today's spend and
 *    the next refresh time.
 *  - `consume_daily_free_or_credits()` (used across the app) spends a free daily
 *    use first, then real credits.
 */
import { supabase } from "@/integrations/supabase/client";
import { CREDITS_CHANGED_EVENT } from "@/hooks/useCredits";

export interface CreditOverview {
  credits: number;
  plan: string;
  dailyAllowance: number;
  claimedToday: boolean;
  grantedToday: number;
  nextRefresh: string | null;
  spentToday: number;
  tasksToday: number;
  spentThisMonth: number;
  freeToday: Record<string, number>;
}

const CLAIM_KEY = "megsy_daily_credits_claimed_on";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Claims the daily allowance at most once per day per device; the server is the
 * real guard, this only avoids a pointless round-trip on every mount.
 */
export async function claimDailyCredits(force = false): Promise<number> {
  try {
    if (!force && localStorage.getItem(CLAIM_KEY) === today()) return 0;
  } catch {
    /* storage unavailable — just call the server */
  }
  const { data, error } = await supabase.rpc("claim_daily_credits");
  if (error) return 0;
  try {
    localStorage.setItem(CLAIM_KEY, today());
  } catch {
    /* ignore */
  }
  const granted = Number((data as { granted?: number } | null)?.granted ?? 0);
  if (granted > 0) window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
  return granted;
}

/** Full credits picture for the usage screen. */
export async function fetchCreditOverview(): Promise<CreditOverview | null> {
  const { data, error } = await supabase.rpc("get_credit_overview");
  if (error || !data) return null;
  const d = data as Record<string, unknown>;
  if (d.success !== true) return null;
  return {
    credits: Number(d.credits ?? 0),
    plan: String(d.plan ?? "free"),
    dailyAllowance: Number(d.daily_allowance ?? 0),
    claimedToday: !!d.claimed_today,
    grantedToday: Number(d.granted_today ?? 0),
    nextRefresh: (d.next_refresh as string | null) ?? null,
    spentToday: Number(d.spent_today ?? 0),
    tasksToday: Number(d.tasks_today ?? 0),
    spentThisMonth: Number(d.spent_this_month ?? 0),
    freeToday: (d.free_today as Record<string, number>) ?? {},
  };
}
