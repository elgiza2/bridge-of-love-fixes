/** @doc Payment options menu — minimal bordered rows, no icons, no descriptions. */
import { memo, useEffect, useState } from "react";
import { m as motion } from "framer-motion";
import { CreditCard, Smartphone, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserLang } from "@/lib/authI18n";

import { IOS_SPRING as iosSpring } from "@/pages/chat/constants/motion";

function useIsLightTheme() {
  const [light, setLight] = useState(
    typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") === "light",
  );
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setLight(el.getAttribute("data-theme") === "light");
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    update();
    return () => obs.disconnect();
  }, []);
  return light;
}

export type PayOption = "global" | "local" | "wallets";
export type Gateway = PayOption; // backwards compat

const mobileFont =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (option: PayOption) => void | Promise<void>;
  loading?: PayOption | null;
  title?: string;
  subtitle?: string;
  /** Restrict which options are shown (e.g. Kashier-only on the Egypt site). */
  options?: PayOption[];
  /** Override the label of one or more options. */
  labels?: Partial<Record<PayOption, string>>;
}

const ROWS: Array<{ id: PayOption; label: string }> = [
  { id: "global", label: "Global" },
  { id: "local", label: "Local" },
  { id: "wallets", label: "E-Wallets" },
];

function PaymentGatewaySheetImpl({
  open,
  onClose,
  onSelect,
  loading = null,
  title = "Choose payment method",
  subtitle = "Pick an option.",
  options,
  labels,
}: Props) {
  useIsLightTheme();
  const lang = useUserLang();
  const isArabic = lang.startsWith("ar");
  const resolvedTitle = title === "Choose payment method" && isArabic ? "اختر طريقة الدفع" : title;
  const resolvedSubtitle =
    subtitle === "Pick an option." && isArabic ? "اختر الطريقة المناسبة لك." : subtitle;
  const localizedLabels: Partial<Record<PayOption, string>> = isArabic
    ? { global: "دفع دولي", local: "بطاقة بنكية", wallets: "محفظة إلكترونية" }
    : {};

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/25 sm:items-center"
    >
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <motion.div
        data-plus-menu
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.985 }}
        transition={{ duration: 0.16, ease: [0.22, 0.9, 0.3, 1] }}
        className="pointer-events-auto relative z-[101] flex w-full flex-col overflow-y-auto rounded-t-3xl border border-border/60 bg-background px-5 pb-[calc(env(safe-area-inset-bottom,0px)+18px)] text-foreground shadow-xl sm:max-w-[400px] sm:rounded-3xl md:max-h-[70vh]"
        style={{ fontFamily: mobileFont }}
      >
        <div className="sm:hidden pt-2.5 pb-2 flex items-center justify-center shrink-0">
          <div className="h-1 w-9 rounded-full bg-muted-foreground/25" />
        </div>

        <div className="pt-2 pb-4">
          <p className="text-[17px] font-semibold leading-tight">{resolvedTitle}</p>
          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
            {resolvedSubtitle}
          </p>
        </div>

        <div className="flex flex-col gap-2.5 pb-1">
          {ROWS.filter((row) => !options || options.includes(row.id)).map((row) => {
            const isLoading = loading === row.id;
            const disabled = loading !== null && !isLoading;
            const Icon = row.id === "wallets" ? Smartphone : CreditCard;
            const tone =
              row.id === "wallets"
                ? "border-emerald-500/20 bg-emerald-500/[0.06] hover:bg-emerald-500/[0.12]"
                : "border-blue-500/20 bg-blue-500/[0.06] hover:bg-blue-500/[0.12]";
            const iconTone =
              row.id === "wallets"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-blue-600 dark:text-blue-400";
            return (
              <Button
                data-no-neo
                key={row.id}
                type="button"
                disabled={disabled || isLoading}
                onClick={() => onSelect(row.id)}
                variant="ghost"
                aria-label={labels?.[row.id] ?? localizedLabels[row.id] ?? row.label}
                className={`h-14 w-full justify-start gap-3 rounded-xl border px-3 text-start text-foreground shadow-none transition-colors ${tone}`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${iconTone}`} strokeWidth={1.75} />
                <span className="flex-1 text-[15px] font-semibold leading-tight text-foreground">
                  {labels?.[row.id] ?? localizedLabels[row.id] ?? row.label}
                </span>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/60 rtl:rotate-180"
                    strokeWidth={1.75}
                  />
                )}
              </Button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

const PaymentGatewaySheet = memo(PaymentGatewaySheetImpl);
export default PaymentGatewaySheet;
