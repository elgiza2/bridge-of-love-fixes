/**
 * @doc Pricing — deliberately plain.
 *
 * The previous version was a cinematic marketing page: hero video, per-letter
 * text animations, count-up numbers, long feature lists and a wall of copy.
 * People come here to compare two prices, so this page shows exactly that —
 * a short headline, a billing switch, two cards with five lines each, and a
 * small FAQ. All checkout behaviour (Dodo globally, Kashier for Egypt/Arabic
 * billing, the one-time trial) is unchanged.
 */
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseFunction";
import SEOHead from "@/components/common/SEOHead";
import { Helmet } from "react-helmet-async";
import { usePrefetchOnIdle } from "@/hooks/usePrefetchOnIdle";
import { useIsMobile } from "@/hooks/use-mobile";
import MobilePricingScreen from "@/components/mobile-showcase/MobilePricingScreen";
import MobilePushShell from "@/components/layout/MobilePushShell";
import AppSidebar from "@/components/layout/AppSidebar";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import type { Gateway } from "@/components/billing/PaymentGatewaySheet";

import {
  PLANS as RAW_PLANS,
  FAQS as RAW_FAQS,
  PLAN_HIGHLIGHTS,
  getDisplayPrice,
  type PlanTier,
} from "@/data/pricingData";
import {
  markCheckoutOpened,
  hasAbandonedCheckout,
  TRIAL_PRICE,
  TRIAL_DAYS,
} from "@/lib/pricingOffers";
import { dodoProductId } from "@/lib/dodoCatalog";
import { brandText, getZoneBrand } from "@/lib/zoneBrand";
import { isEgMode } from "@/lib/egMode";
import { isArabBilling } from "@/lib/payRegion";
import { useUserLang } from "@/lib/authI18n";
import { useIntroTrialEligible } from "@/lib/introTrial";
import { cn } from "@/lib/utils";
import { useUserPlan } from "@/hooks/useUserPlan";

const LandingFooter = lazy(() => import("@/components/landing/LandingFooter"));
const PaymentGatewaySheet = lazy(() => import("@/components/billing/PaymentGatewaySheet"));

/** Only the four questions people actually ask before paying. */
const FAQ_LIMIT = 4;

const PricingPage = () => {
  const navigate = useNavigate();
  usePrefetchOnIdle(["/auth", "/chat"], 1500);

  const [isYearly, setIsYearly] = useState(false);
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [gatewaySheet, setGatewaySheet] = useState<{
    tier: PlanTier;
    interval: "monthly" | "yearly";
    trial: boolean;
  } | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState<Gateway | null>(null);
  const {
    plan: activePlan,
    isPaid: hasActiveSubscription,
    loading: subscriptionLoading,
  } = useUserPlan();

  const BRAND = getZoneBrand();
  const lang = useUserLang();
  const isAr = typeof lang === "string" && lang.toLowerCase().startsWith("ar");
  const trialEligible = useIntroTrialEligible();
  const [sidebarCollapsed] = useSidebarCollapsed();
  const PLANS = brandText(RAW_PLANS);
  const FAQS = brandText(RAW_FAQS).slice(0, FAQ_LIMIT);

  const t = isAr
    ? {
        title: "خطة واحدة بسيطة، وكل حاجة جواها",
        sub: "شات وصور وفيديو وكمبيوتر سحابي — اشتراك واحد، تقدر تلغيه في أي وقت.",
        monthly: "شهري",
        yearly: "سنوي",
        yearlyHint: "٤ شهور مجانًا",
        cta: "ابدأ الآن",
        firstMonth: "الشهر الأول",
        perMonth: "/ شهر",
        perYear: "/ سنة",
        popular: "الأكثر اختيارًا",
        trial: `جرّب ${TRIAL_DAYS} أيام بـ ${TRIAL_PRICE}$`,
        faq: "أسئلة شائعة",
        subscribed: "أنت بالفعل مشترك",
        upgrade: "ترقية الخطة",
        cancel: "إلغاء الاشتراك",
      }
    : {
        title: "Simple plans. Everything included.",
        sub: "Chat, images, video and a cloud computer — one subscription, cancel anytime.",
        monthly: "Monthly",
        yearly: "Yearly",
        yearlyHint: "4 months free",
        cta: "Get started",
        firstMonth: "First month",
        perMonth: "/ month",
        perYear: "/ year",
        popular: "Most popular",
        trial: `Try ${TRIAL_DAYS} days for $${TRIAL_PRICE}`,
        faq: "Questions",
        subscribed: "You are already subscribed",
        upgrade: "Upgrade plan",
        cancel: "Cancel subscription",
      };

  const pricingLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${BRAND} AI`,
    description:
      "All-in-one AI workspace — chat, image, video, slides, docs and full-stack builds on one subscription.",
    brand: { "@type": "Brand", name: `${BRAND} AI` },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: Math.min(...PLANS.map((p) => p.monthlyPrice)).toString(),
      highPrice: Math.max(...PLANS.map((p) => p.monthlyPrice)).toString(),
      offerCount: PLANS.length,
      offers: PLANS.map((p) => ({
        "@type": "Offer",
        name: p.name,
        priceCurrency: "USD",
        price: p.monthlyPrice.toString(),
        url: "https://megsyai.com/pricing",
        category: "SubscriptionMonthly",
      })),
    },
  };

  const handleSubscribe = async (
    tier: PlanTier,
    opts: { trial?: boolean; interval?: "monthly" | "yearly" } = {},
  ) => {
    if (loadingTier) return;
    const interval: "monthly" | "yearly" = opts.interval ?? (isYearly ? "yearly" : "monthly");

    let {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session;
    }
    if (!session?.access_token) {
      await supabase.auth.signOut().catch(() => {});
      toast.error("Please sign in again to continue.");
      navigate("/auth?redirect=/pricing");
      return;
    }

    // Egypt edition or an Arabic account: Kashier (card + wallets) — show the picker.
    if (isEgMode() || isArabBilling()) {
      setGatewaySheet({ tier, interval, trial: opts.trial === true });
      return;
    }
    await runCheckout("global", { tier, interval, trial: opts.trial === true });
  };

  const runCheckout = async (
    gateway: Gateway,
    ctx?: { tier: PlanTier; interval: "monthly" | "yearly"; trial: boolean },
  ) => {
    const target = ctx ?? gatewaySheet;
    if (!target) return;
    const { tier, interval, trial } = target;
    setGatewayLoading(gateway);
    setLoadingTier(tier);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Please sign in again to continue.");
        navigate("/auth?redirect=/pricing");
        return;
      }

      const provider = gateway === "global" ? "dodo" : "kashier";
      const method = gateway === "wallets" ? "wallet" : "card";

      if (provider === "kashier") {
        const skuMap: Record<string, string> = {
          "pro:monthly": "plan_pro_m_first",
          "elite:monthly": "plan_elite_m",
        };
        const sku =
          trial && tier === "pro" && interval === "monthly"
            ? "plan_pro_m_trial"
            : skuMap[`${tier}:${interval}`];
        if (!sku) throw new Error("This plan isn't available for local payment yet.");

        const { data: kData, error: kErr } = await supabase.functions.invoke("kashier-checkout", {
          body: { sku, method, display: isEgMode() || isArabBilling() ? "ar" : "en" },
        });
        if (kErr || !kData?.checkout_url) {
          throw new Error(kErr?.message || kData?.error || "Checkout failed");
        }
        markCheckoutOpened(interval);
        window.location.href = kData.checkout_url;
        return;
      }

      const { data, error } = await invokeFunction("openrouter-media", {
        body: {
          kind: "checkout",
          tier,
          interval,
          trial,
          free_trial: trial,
          provider,
          ...(trial ? {} : { product_id: dodoProductId(interval, hasAbandonedCheckout()) }),
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        const msg = (error as any)?.message?.toLowerCase?.() || "";
        if (msg.includes("unauthorized") || msg.includes("401") || msg.includes("jwt")) {
          await supabase.auth.signOut().catch(() => {});
          toast.error("Your session expired. Please sign in again.");
          navigate("/auth?redirect=/pricing");
          return;
        }
        throw error;
      }
      if (data?.url) {
        markCheckoutOpened(interval);
        window.location.href = data.url;
      } else throw new Error(data?.error || "Checkout failed");
    } catch (e: any) {
      toast.error(e?.message || "Failed to open checkout. Please try again.");
    } finally {
      setGatewayLoading(null);
      setLoadingTier(null);
      setGatewaySheet(null);
    }
  };

  // Arriving from the onboarding "3 days free" button opens trial checkout once.
  const trialAutoStarted = useRef(false);
  useEffect(() => {
    if (trialAutoStarted.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("offer") !== "free_trial") return;
    trialAutoStarted.current = true;
    void handleSubscribe("pro", { trial: true, interval: "monthly" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMobile = useIsMobile();
  const proPlan = PLANS.find((p) => p.tier === "pro");

  const gatewaySheetNode = (
    <Suspense fallback={null}>
      {gatewaySheet && (
        <PaymentGatewaySheet
          open={!!gatewaySheet}
          onClose={() => setGatewaySheet(null)}
          onSelect={runCheckout}
          loading={gatewayLoading}
          options={["local", "wallets"]}
          labels={{
            local: "Visa / Mastercard",
            wallets: "Mobile wallets (Vodafone Cash and others)",
          }}
        />
      )}
    </Suspense>
  );

  // ─── Mobile keeps its dedicated showcase screen ──
  if (isMobile && proPlan) {
    return (
      <>
        <SEOHead
          title={`Pricing — ${BRAND} AI Plans & Credits`}
          description={`Simple plans for ${BRAND} AI. Chat, images, video, slides and full-stack builds — one subscription.`}
          path="/pricing"
        />
        <Helmet>
          <script type="application/ld+json">{JSON.stringify(pricingLd)}</script>
        </Helmet>
        <MobilePushShell
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          onNewChat={() => navigate("/")}
          currentMode="chat"
        >
          <MobilePricingScreen
            isYearly={isYearly}
            onToggleYearly={setIsYearly}
            loadingTier={loadingTier}
            onSubscribe={(tier, opts) =>
              handleSubscribe(tier, {
                interval: isYearly ? "yearly" : "monthly",
                trial: opts?.trial === true,
              })
            }
            onMenuClick={() => setMobileOpen(true)}
          />
        </MobilePushShell>
        {gatewaySheetNode}
      </>
    );
  }

  return (
    <>
      <SEOHead
        title={`Pricing — ${BRAND} AI Plans & Credits`}
        description={`Simple plans for ${BRAND} AI. Chat, images, video, slides and full-stack builds on one subscription.`}
        path="/pricing"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(pricingLd)}</script>
      </Helmet>

      <div className="flex min-h-[100dvh] w-full overflow-x-hidden bg-background rtl:flex-row-reverse">
        <aside
          data-chat-sidebar="true"
          style={{ width: !sidebarCollapsed ? 280 : 60 }}
          className="hidden shrink-0 overflow-hidden border-e border-border transition-[width] duration-200 ease-out md:flex"
        >
          <AppSidebar
            inline
            open
            forceExpanded={false}
            onClose={() => {}}
            onNewChat={() => navigate("/")}
            onSelectConversation={() => {}}
            currentMode="chat"
          />
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-6 py-16" dir={isAr ? "rtl" : "ltr"}>
            <header className="text-center">
              <h1 className="text-balance text-[34px] font-semibold leading-tight tracking-tight text-foreground sm:text-[42px]">
                {t.title}
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                {t.sub}
              </p>
            </header>

            {/* Billing switch */}
            <div className="mt-8 flex justify-center">
              <div
                role="tablist"
                aria-label={t.monthly + " / " + t.yearly}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 p-1"
              >
                {([false, true] as const).map((yearly) => (
                  <button
                    key={String(yearly)}
                    role="tab"
                    aria-selected={isYearly === yearly}
                    type="button"
                    onClick={() => setIsYearly(yearly)}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-[13.5px] font-medium transition-colors",
                      isYearly === yearly
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {yearly ? t.yearly : t.monthly}
                  </button>
                ))}
              </div>
            </div>
            {isYearly ? (
              <p className="mt-2 text-center text-[12.5px] text-primary">{t.yearlyHint}</p>
            ) : null}

            {/* Plans */}
            <section id="plans-grid" className="mt-10 grid gap-5 sm:grid-cols-2">
              {PLANS.filter((p) => p.tier === "pro" || p.tier === "elite").map((plan) => {
                const price = getDisplayPrice(plan, isYearly);
                const highlights = PLAN_HIGHLIGHTS[plan.tier === "pro" ? "pro" : "max"];
                const busy = loadingTier === plan.tier;
                const featured = plan.tier === "pro";
                const isCurrentPlan = hasActiveSubscription && activePlan === plan.tier;
                return (
                  <article
                    key={plan.tier}
                    className={cn(
                      "relative flex flex-col rounded-3xl border bg-card p-6",
                      featured ? "border-primary/50 shadow-lg shadow-primary/5" : "border-border",
                    )}
                  >
                    {featured ? (
                      <span className="absolute -top-3 start-6 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                        {t.popular}
                      </span>
                    ) : null}

                    <h2 className="text-[17px] font-semibold text-foreground">{plan.name}</h2>

                    <div className="mt-4 flex items-end gap-2">
                      <span className="text-[38px] font-semibold leading-none text-foreground">
                        ${price.price}
                      </span>
                      <span className="pb-1 text-[13px] text-muted-foreground">
                        {isYearly ? t.perYear : t.perMonth}
                      </span>
                    </div>
                    {price.isIntro ? (
                      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                        {t.firstMonth} · ${plan.monthlyPrice} {t.perMonth}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                        {price.discountLabel || plan.monthlyCredits}
                      </p>
                    )}
                    {featured && trialEligible && !isYearly ? (
                      <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/[0.06] px-3.5 py-3 text-center">
                        <p className="text-[13px] font-semibold text-primary">{t.trial}</p>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                          {isAr
                            ? "عرض البداية متاح للحسابات المؤهلة فقط."
                            : "Available once for eligible accounts."}
                        </p>
                      </div>
                    ) : null}

                    <ul className="mt-6 flex-1 space-y-2.5">
                      {highlights.map((line) => (
                        <li
                          key={line}
                          className="flex gap-2.5 text-[13.5px] leading-snug text-foreground/85"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrentPlan ? (
                      <div className="mt-6 space-y-2">
                        <div className="flex h-11 w-full items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10 text-[14px] font-semibold text-emerald-700 dark:text-emerald-300">
                          {subscriptionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            t.subscribed
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => navigate("/billing")}
                          className="h-9 w-full rounded-full text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSubscribe(plan.tier)}
                        className={cn(
                          "mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-semibold transition-opacity disabled:opacity-60",
                          hasActiveSubscription
                            ? "border border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
                            : featured
                              ? "bg-primary text-primary-foreground hover:opacity-90"
                              : "border border-border bg-background text-foreground hover:bg-muted",
                        )}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {hasActiveSubscription ? t.upgrade : t.cta}
                      </button>
                    )}

                    {featured && trialEligible && !isYearly ? (
                      <button
                        type="button"
                        onClick={() =>
                          void handleSubscribe("pro", { trial: true, interval: "monthly" })
                        }
                        className="mt-2.5 text-[12.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {t.trial}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </section>

            {/* FAQ */}
            <section id="pricing-faq" className="mt-16">
              <h2 className="text-[20px] font-semibold text-foreground">{t.faq}</h2>
              <dl className="mt-5 divide-y divide-border border-y border-border">
                {FAQS.map((f) => (
                  <div key={f.q} className="py-5">
                    <dt className="text-[14.5px] font-medium text-foreground">{f.q}</dt>
                    <dd className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
                      {f.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <Suspense fallback={null}>
            <LandingFooter />
          </Suspense>
        </main>
      </div>

      {gatewaySheetNode}
    </>
  );
};

export default PricingPage;
