/** @doc Usage — plan, live credit balance, daily allowance and real credit history. */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, ChevronLeft, CalendarClock, Gauge, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { goBackOr } from "@/lib/navigation";
import {
  claimDailyCredits,
  fetchCreditOverview,
  type CreditOverview,
} from "@/lib/creditsSystem";

type Tx = {
  id: string;
  amount: number;
  description: string | null;
  action_type: string | null;
  created_at: string;
};

/** Never expose upstream provider or model names in the UI. */
const cleanLabel = (raw: string | null, action: string | null) => {
  const s = `${raw ?? ""} ${action ?? ""}`.toLowerCase();
  if (/reward|follow|bonus/.test(s)) return "Reward";
  if (/refresh|daily/.test(s)) return "Daily refresh";
  if (/video|veo|sora|kling|hailuo|seedance|ltx/.test(s)) return "Video generation";
  if (/headshot|inpaint|bg-remover|remover|colorizer|sketch|retouch|perspective|product-photo|thumbnail|hair|character-swap|storyboard|image-tool/.test(s))
    return "Image editing";
  if (/image|seedream|gpt-image|render/.test(s)) return "Image generation";
  if (/slide|presentation/.test(s)) return "Presentation";
  if (/research|report/.test(s)) return "Research";
  if (/page|code|web/.test(s)) return "Web page";
  if (/chat|message|manus|generation/.test(s)) return "Generation";
  return "Task";
};

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const UsagePage = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<CreditOverview | null>(null);
  const [rows, setRows] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setSignedOut(true);
          setLoading(false);
        }
        return;
      }
      // Opening this screen is also the moment to hand out today's credits.
      await claimDailyCredits();
      const [ov, tx] = await Promise.all([
        fetchCreditOverview(),
        supabase
          .from("credit_transactions")
          .select("id, amount, description, action_type, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(80),
      ]);
      if (cancelled) return;
      setOverview(ov);
      setRows((tx.data as Tx[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const plan = (overview?.plan ?? "free").toLowerCase();
  const isPaidPlan = plan !== "free";
  const planLabel = plan === "free" ? "Free" : plan.toUpperCase();
  const credits = overview?.credits ?? null;
  const creditsLabel =
    credits === null ? "—" : Math.round(credits).toLocaleString("en-US");

  const refreshLabel = useMemo(() => {
    if (!overview?.nextRefresh) return null;
    const at = new Date(overview.nextRefresh);
    const mins = Math.max(0, Math.round((at.getTime() - Date.now()) / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
  }, [overview?.nextRefresh]);

  const groups = useMemo(() => {
    const map = new Map<string, Tx[]>();
    rows.forEach((r) => {
      const key = dayLabel(r.created_at);
      map.set(key, [...(map.get(key) ?? []), r]);
    });
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="usg-root" dir="ltr">
      <style>{usageCss}</style>
      <div className="usg-screen">
        <header className="usg-top">
          <button type="button" className="usg-iconbtn" aria-label="Back" onClick={() => goBackOr(navigate, "/settings")}>
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <h1 className="usg-title">Usage</h1>
          <span className="usg-iconbtn usg-ghost" />
        </header>

        <main className="usg-body">
          <section className="usg-card usg-rise">
            <div className="usg-plan">
              <span className="usg-plan-name">{planLabel}</span>
              <button type="button" className="usg-cta" onClick={() => navigate("/pricing")}>
                {isPaidPlan ? "Manage" : "Upgrade"}
              </button>
            </div>

            <div className="usg-line">
              <Coins className="usg-licon" />
              <span className="usg-llabel">
                Credits
                <small>Available to spend right now</small>
              </span>
              <span className="usg-lvalue">{creditsLabel}</span>
            </div>

            <div className="usg-line">
              <CalendarClock className="usg-licon" />
              <span className="usg-llabel">
                Daily credits
                <small>
                  {overview
                    ? `Tops up to ${overview.dailyAllowance} every day${refreshLabel ? ` · next ${refreshLabel}` : ""}`
                    : "—"}
                </small>
              </span>
              <span className="usg-lvalue">{overview ? overview.dailyAllowance : "—"}</span>
            </div>

            <div className="usg-line">
              <Gauge className="usg-licon" />
              <span className="usg-llabel">
                Used today
                <small>
                  {overview
                    ? `${overview.tasksToday} ${overview.tasksToday === 1 ? "task" : "tasks"} · ${Math.round(overview.spentThisMonth)} this month`
                    : "—"}
                </small>
              </span>
              <span className="usg-lvalue">
                {overview ? Math.round(overview.spentToday) : "—"}
              </span>
            </div>
          </section>

          {loading ? (
            <div className="usg-state"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : signedOut ? (
            <div className="usg-state">Sign in to see your credits</div>
          ) : groups.length === 0 ? (
            <div className="usg-state">No usage yet</div>
          ) : (
            groups.map(([day, items], gi) => (
              <section key={day} className="usg-group usg-rise" style={{ animationDelay: `${60 + gi * 40}ms` }}>
                <h2 className="usg-day">{day}</h2>
                <div className="usg-card usg-list">
                  {items.map((it) => {
                    const amount = Number(it.amount) || 0;
                    // Grants are stored as negatives, spending as positives.
                    const isGrant = amount < 0;
                    return (
                      <div key={it.id} className="usg-item">
                        <span className="usg-item-title">
                          {cleanLabel(it.description, it.action_type)}
                          <small>{timeLabel(it.created_at)}</small>
                        </span>
                        <span className={`usg-item-cost ${isGrant ? "usg-plus" : ""}`}>
                          {isGrant ? "+" : "−"}
                          {Math.round(Math.abs(amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
          <div className="usg-spacer" />
        </main>
      </div>
    </div>
  );
};

const usageCss = `
.usg-root {
  min-height: 100dvh; background: var(--mn-bg); color: var(--mn-fg);
  display: flex; justify-content: center;
  font-family: -apple-system, "SF Pro Display", Inter, "Segoe UI", Roboto, sans-serif;
}
.usg-screen { width: 100%; max-width: 420px; }
.usg-top {
  position: sticky; top: 0; z-index: 5; background: var(--mn-bg);
  display: flex; align-items: center; justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 8px) 8px 8px;
}
.usg-iconbtn {
  width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 0; color: var(--mn-fg); cursor: pointer; -webkit-tap-highlight-color: transparent;
}
.usg-ghost { pointer-events: none; }
.usg-title { font-size: 16px; font-weight: 600; margin: 0; }
.usg-body { padding: 2px 12px 28px; display: flex; flex-direction: column; gap: 14px; }
.usg-card { background: var(--mn-card); border-radius: 14px; padding: 12px 12px 4px; }
.usg-plan { display: flex; align-items: center; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px dashed var(--mn-sep); }
.usg-plan-name { font-size: 18px; font-weight: 700; letter-spacing: -.01em; }
.usg-cta {
  background: var(--mn-cta-bg); color: var(--mn-cta-fg); border: 0; border-radius: 9px;
  font-size: 12.5px; font-weight: 600; padding: 7px 13px; cursor: pointer;
}
.usg-banner {
  width: 100%; margin: 10px 0 4px; display: flex; align-items: center; justify-content: space-between;
  gap: 8px; background: color-mix(in srgb, var(--mn-accent) 14%, transparent); color: var(--mn-accent); border: 0; border-radius: 10px;
  padding: 10px 12px; font-size: 12.5px; font-weight: 500; cursor: pointer; text-align: left;
}
.usg-line { display: flex; align-items: center; gap: 8px; padding: 10px 2px; }
.usg-line-sub { padding-top: 0; }
.usg-licon { width: 16px; height: 16px; color: var(--mn-fg); flex: none; }
.usg-llabel { flex: 1; font-size: 13.5px; display: flex; flex-direction: column; gap: 1px; }
.usg-llabel small { font-size: 10.5px; color: var(--mn-muted); }
.usg-lhelp { width: 12px; height: 12px; color: var(--mn-faint); }
.usg-lvalue { font-size: 13.5px; font-weight: 600; }
.usg-muted { color: var(--mn-muted); font-weight: 400; padding-inline-start: 24px; }
.usg-group { display: flex; flex-direction: column; gap: 6px; }
.usg-day { font-size: 11.5px; color: var(--mn-muted); margin: 0 4px; font-weight: 500; }
.usg-list { padding: 2px 12px; }
.usg-item { display: flex; align-items: center; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--mn-sep); }
.usg-item:last-child { border-bottom: 0; }
.usg-item-title { flex: 1; font-size: 13.5px; line-height: 1.35; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.usg-item-title small { font-size: 10.5px; color: var(--mn-muted); }
.usg-item-cost { font-size: 13px; color: var(--mn-muted); font-variant-numeric: tabular-nums; }
.usg-item-cost.usg-plus { color: #10b981; }
.usg-state { display: flex; align-items: center; justify-content: center; padding: 36px 0; color: var(--mn-muted); font-size: 13px; }
.usg-spacer { height: env(safe-area-inset-bottom, 0px); }
.usg-rise { animation: usg-rise .32s cubic-bezier(.22,.61,.36,1) both; }
@keyframes usg-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .usg-rise { animation: none; } }
`;

export default UsagePage;
