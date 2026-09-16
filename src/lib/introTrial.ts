/** @doc Eligibility for the one-time $1 / 3-day intro trial.
 *
 *  The trial replaces the $7 first-month offer while the user has never taken
 *  it. Only a confirmed trial checkout consumes it; a regular subscription or
 *  an abandoned checkout must not make the offer disappear.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// v1 was written when checkout opened, which incorrectly consumed the offer
// for users who abandoned payment. v2 is written only after a confirmed paid
// trial reaches the success page.
const LOCAL_KEY = "megsy_intro_trial_used_v2";
const LEGACY_LOCAL_KEY = "megsy_intro_trial_used_v1";

function readLocal(): boolean {
  try {
    localStorage.removeItem(LEGACY_LOCAL_KEY);
    return localStorage.getItem(LOCAL_KEY) === "1";
  } catch {
    return false;
  }
}

/** Remember locally that the trial is spent, so it never flashes back. */
export function markIntroTrialUsed() {
  try {
    localStorage.setItem(LOCAL_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

/** Server truth: has this account ever started the intro trial? */
export async function hasUsedIntroTrial(): Promise<boolean> {
  if (readLocal()) return true;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // A visitor who is not signed in has not used it yet.
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("trial_ends_at")
    .eq("id", user.id)
    .maybeSingle();

  const used = !!(profile as { trial_ends_at?: string | null } | null)?.trial_ends_at;
  if (used) markIntroTrialUsed();
  return used;
}

/**
 * `true` while the $1 trial may still be offered. Starts as `true` only after
 * the check resolves, so the $1 headline never flashes for someone who
 * already used it.
 */
export function useIntroTrialEligible(): boolean {
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const used = await hasUsedIntroTrial();
      if (!cancelled) setEligible(!used);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return eligible;
}
