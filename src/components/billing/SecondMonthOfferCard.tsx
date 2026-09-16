/**
 * SecondMonthOfferCard — retention upsell shown right after a successful
 * first payment: "take month two at the same intro price".
 *
 * Pricing/copy comes from SECOND_MONTH_OFFER in @/data/pricingData so the
 * offer can never drift from the /pricing page.
 */
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunction";
import { SECOND_MONTH_OFFER } from "@/data/pricingData";
import { isEgMode } from "@/lib/egMode";
import { isArabBilling } from "@/lib/payRegion";
import { trackTikTokFunnelEvent } from "@/lib/analytics/tiktokPixel";
import { openCheckoutUrl } from "@/lib/openCheckout";

interface Props {
  /** Tier the user just subscribed to. */
  tier?: "pro" | "elite";
}

export default function SecondMonthOfferCard({ tier = "pro" }: Props) {
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!SECOND_MONTH_OFFER.enabled || dismissed) return null;

  const payNow = async () => {
    if (loading) return;
    setLoading(true);
    trackTikTokFunnelEvent("InitiateCheckout", {
      contentId: `${tier}:second_month`,
      contentName: `${tier} second month offer`,
      currency: "USD",
    });

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in again to continue.");
        return;
      }

      // One payload for both gateways: the server resolves the catalog row and
      // therefore the price, the credits and the product id.
      const local = isEgMode() || isArabBilling();
      const { data, error } = await invokeFunction("kashier-checkout", {
        body: {
          kind: "checkout",
          provider: local ? "kashier" : "dodo",
          tier,
          interval: "monthly",
          trial: false,
          offer: "second_month",
          winback: true,
          method: "card",
          display: local ? "ar" : "en",
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      const checkoutUrl = data?.url || data?.checkout_url;
      if (checkoutUrl) {
        setClaimed(true);
        openCheckoutUrl(checkoutUrl);
      } else {
        throw new Error(data?.error || "Checkout failed");
      }

    } catch (e: any) {
      toast.error(e?.message || "Couldn't open checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4 text-left">
      <p className="text-[14px] font-medium text-foreground">{SECOND_MONTH_OFFER.titleEn}</p>
      <p className="mt-1 text-[12.5px] leading-snug text-foreground/60">
        {SECOND_MONTH_OFFER.bodyEn}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={payNow}
          disabled={loading || claimed}
          className="flex-1 rounded-xl border border-emerald-400/40 bg-emerald-400/15 px-4 py-3 text-[13.5px] font-medium text-foreground transition hover:bg-emerald-400/25 disabled:opacity-50"
        >
          {loading ? "Opening checkout…" : SECOND_MONTH_OFFER.ctaEn}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-xl border border-foreground/10 px-3 py-3 text-[13px] text-foreground/55 transition hover:text-foreground/80"
        >
          Not now
        </button>
      </div>
      <p className="mt-2 text-[11px] text-foreground/45">
        Offer valid for {SECOND_MONTH_OFFER.windowHours} hours after your first payment.
      </p>
    </div>
  );
}
