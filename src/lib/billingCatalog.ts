/**
 * @doc Billing catalog — the single source of truth for what a plan costs.
 *
 * Every price, credit amount and provider product id lives in the
 * `billing_catalog` table. The page reads it (public, read-only) and the
 * checkout function reads the very same rows, so the price on screen can never
 * drift from the price that is charged.
 *
 * `PRICING_FALLBACK` only exists so the first paint (and an offline visitor)
 * still sees sensible numbers; the fetched rows always win.
 */
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export type CatalogTier = "pro" | "elite";
export type CatalogInterval =
  | "monthly"
  | "monthly_intro"
  | "monthly_winback"
  | "monthly_trial"
  | "yearly"
  | "yearly_winback";

export interface CatalogEntry {
  tier: CatalogTier;
  interval: CatalogInterval;
  baseInterval: "monthly" | "yearly";
  usd: number;
  egp: number | null;
  credits: number;
  dodoProductId: string | null;
  kashierSku: string | null;
  trialDays: number;
}

/** Offline / first-paint values. Mirrors the seeded catalog rows. */
export const PRICING_FALLBACK: CatalogEntry[] = [
  entry("pro", "monthly", 20, 999, 240),
  entry("pro", "monthly_intro", 7, 349, 240),
  entry("pro", "monthly_winback", 5, 249, 240),
  { ...entry("pro", "monthly_trial", 1, 49, 240), trialDays: 3 },
  entry("pro", "yearly", 160, 7999, 3600),
  entry("pro", "yearly_winback", 149, 7499, 3600),
  entry("elite", "monthly", 40, 1999, 600),
  entry("elite", "monthly_intro", 17, 849, 600),
  entry("elite", "monthly_winback", 12, 599, 600),
  entry("elite", "yearly", 320, 15999, 9000),
  entry("elite", "yearly_winback", 299, 14999, 9000),
];

function entry(
  tier: CatalogTier,
  interval: CatalogInterval,
  usd: number,
  egp: number | null,
  credits: number,
): CatalogEntry {
  return {
    tier,
    interval,
    baseInterval: interval.startsWith("yearly") ? "yearly" : "monthly",
    usd,
    egp,
    credits,
    dodoProductId: null,
    kashierSku: null,
    trialDays: 0,
  };
}

let cache: CatalogEntry[] | null = null;
let inflight: Promise<CatalogEntry[]> | null = null;

/** Fetch the live catalog once per page load. Never throws. */
export async function loadBillingCatalog(): Promise<CatalogEntry[]> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from("billing_catalog")
        .select(
          "tier, interval, base_interval, usd_price, egp_price, credits, dodo_product_id, kashier_sku, trial_days",
        )
        .eq("active", true);
      if (error || !data?.length) return PRICING_FALLBACK;
      cache = data.map((row) => ({
        tier: row.tier as CatalogTier,
        interval: row.interval as CatalogInterval,
        baseInterval: (row.base_interval === "yearly" ? "yearly" : "monthly") as
          | "monthly"
          | "yearly",
        usd: Number(row.usd_price),
        egp: row.egp_price === null ? null : Number(row.egp_price),
        credits: Number(row.credits ?? 0),
        dodoProductId: row.dodo_product_id ?? null,
        kashierSku: row.kashier_sku ?? null,
        trialDays: Number(row.trial_days ?? 0),
      }));
      return cache;
    } catch {
      return PRICING_FALLBACK;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/**
 * Which catalog row a given choice resolves to. Exactly the same rule the
 * checkout function applies server-side.
 */
export function catalogSlot(
  interval: "monthly" | "yearly",
  opts: { trial?: boolean; winback?: boolean } = {},
): CatalogInterval {
  if (interval === "yearly") return opts.winback ? "yearly_winback" : "yearly";
  if (opts.trial) return "monthly_trial";
  return opts.winback ? "monthly_winback" : "monthly_intro";
}

export function findEntry(
  list: CatalogEntry[],
  tier: CatalogTier,
  interval: CatalogInterval,
): CatalogEntry | null {
  return list.find((e) => e.tier === tier && e.interval === interval) ?? null;
}

/** Live catalog for React components, starting from the fallback. */
export function useBillingCatalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>(cache ?? PRICING_FALLBACK);
  const [ready, setReady] = useState<boolean>(!!cache);
  useEffect(() => {
    let alive = true;
    void loadBillingCatalog().then((list) => {
      if (!alive) return;
      setEntries(list);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return { entries, ready };
}

/** Price for a choice, in USD, with the fallback applied automatically. */
export function priceFor(
  entries: CatalogEntry[],
  tier: CatalogTier,
  interval: "monthly" | "yearly",
  opts: { trial?: boolean; winback?: boolean } = {},
): CatalogEntry | null {
  const slot = catalogSlot(interval, opts);
  return (
    findEntry(entries, tier, slot) ??
    findEntry(entries, tier, interval) ??
    findEntry(PRICING_FALLBACK, tier, slot)
  );
}

/** True when the paid trial is actually sellable (a row exists and is active). */
export function trialAvailable(entries: CatalogEntry[], tier: CatalogTier = "pro"): boolean {
  return !!findEntry(entries, tier, "monthly_trial");
}
