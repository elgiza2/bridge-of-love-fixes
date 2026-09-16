/** @doc Eligibility for the one-time $1 / 3-day intro trial.
 *
 *  The trial replaces the $7 first-month offer while the user has never taken
 *  it. Only a confirmed trial checkout consumes it; a regular subscription, an
 *  abandoned checkout, or another account on the same device must not make the
 *  offer disappear.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// v1/v2 were account-agnostic: one confirmed trial hid the offer for every
// account (and every visitor) on that device. v3 is scoped per user id.
const LOCAL_PREFIX = "megsy_intro_trial_used_v3:";
const LEGACY_KEYS = ["megsy_intro_trial_used_v1", "megsy_intro_trial_used_v2"];

function dropLegacy() {
  try {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

function readLocal(userId: string): boolean {
  try {
    dropLegacy();
    return localStorage.getItem(LOCAL_PREFIX + userId) === "1";
  } catch {
    return false;
  }
}

/** Remember locally that this account's trial is spent, so it never flashes back. */
export async function markIntroTrialUsed(): Promise<void> {
  dropLegacy();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    localStorage.setItem(LOCAL_PREFIX + user.id, "1");
  } catch {
    /* storage unavailable */
  }
}

/** Server truth: has this account ever started the intro trial? */
export async function hasUsedIntroTrial(): Promise<boolean> {
  dropLegacy();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A visitor who is not signed in has not used it yet.
  if (!user) return false;
  if (readLocal(user.id)) return true;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("trial_ends_at")
    .eq("id", user.id)
    .maybeSingle();

  // A failed read must not silently hide the offer.
  if (error) return false;

  const used = !!(profile as { trial_ends_at?: string | null } | null)?.trial_ends_at;
  if (used) {
    try {
      localStorage.setItem(LOCAL_PREFIX + user.id, "1");
    } catch {
      /* storage unavailable */
    }
  }
  return used;
}

/**
 * `true` while the $1 trial may still be offered. Re-checks whenever the
 * signed-in account changes, so switching or signing out restores the offer
 * for an account that never used it.
 */
export function useIntroTrialEligible(): boolean {
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const used = await hasUsedIntroTrial();
      if (!cancelled) setEligible(!used);
    };
    void check();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void check();
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);
  return eligible;
}
