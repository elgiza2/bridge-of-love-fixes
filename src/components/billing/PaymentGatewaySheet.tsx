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

const ROWS: Array<{
  id: PayOption;
  label: string;
  labelAr: string;
  caption: string;
  captionAr: string;
}> = [
  {
    id: "global",
    label: "International card",
    labelAr: "بطاقة دولية",
    caption: "Paid in USD",
    captionAr: "الدفع بالدولار",
  },
  {
    id: "local",
    label: "Visa or Mastercard",
    labelAr: "فيزا أو ماستركارد",
    caption: "Local bank card",
    captionAr: "بطاقة بنك محلي",
  },
  {
    id: "wallets",
    label: "Mobile wallet",
    labelAr: "محفظة موبايل",
    caption: "Vodafone Cash and others",
    captionAr: "فودافون كاش وغيرها",
  },
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
  const resolvedTitle = title === "Choose payment method" && isArabic ? "طريقة الدفع" : title;
  const resolvedSubtitle =
    subtitle === "Pick an option." && isArabic ? "اختر الطريقة اللي تناسبك." : subtitle;

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

  const visible = ROWS.filter((row) => !options || options.includes(row.id));

  return (
    <div
      dir={isArabic ? "rtl" : "ltr"}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/30 backdrop-blur-[2px] sm:items-center"
    >
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <motion.div
        data-plus-menu
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.99 }}
        transition={iosSpring}
        className="pointer-events-auto relative z-[101] flex w-full flex-col overflow-y-auto rounded-t-[28px] border border-border/50 bg-background px-6 pb-[calc(env(safe-area-inset-bottom,0px)+22px)] text-foreground shadow-2xl sm:max-w-[392px] sm:rounded-[28px] md:max-h-[70vh]"
        style={{ fontFamily: mobileFont }}
      >
        <div className="sm:hidden pt-3 pb-1 flex items-center justify-center shrink-0">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
        </div>

        <div className="pt-5 pb-5 text-center sm:pt-6">
          <p className="text-[20px] font-bold tracking-[-0.01em] leading-tight text-foreground">
            {resolvedTitle}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground/65">
            {resolvedSubtitle}
          </p>
        </div>

        <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60">
          {visible.map((row, i) => {
            const isLoading = loading === row.id;
            const disabled = loading !== null && !isLoading;
            const Icon = row.id === "wallets" ? Smartphone : CreditCard;
            const label = labels?.[row.id] ?? (isArabic ? row.labelAr : row.label);
            const caption = isArabic ? row.captionAr : row.caption;
            return (
              <Button
                data-no-neo
                key={row.id}
                type="button"
                disabled={disabled || isLoading}
                onClick={() => onSelect(row.id)}
                variant="ghost"
                aria-label={label}
                className={`h-[68px] w-full justify-start gap-3.5 rounded-none border-0 bg-transparent px-4 text-start text-foreground shadow-none transition-colors hover:bg-muted/50 disabled:opacity-40 ${
                  i > 0 ? "border-t border-border/50" : ""
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/70">
                  <Icon className="h-[17px] w-[17px] text-foreground/70" strokeWidth={1.6} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[16px] font-semibold leading-tight text-foreground">
                    {label}
                  </span>
                  <span className="truncate text-[13.5px] font-normal leading-tight text-foreground/60">
                    {caption}
                  </span>
                </span>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/45 rtl:rotate-180"
                    strokeWidth={1.75}
                  />
                )}
              </Button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-11 w-full rounded-full text-[14px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {isArabic ? "إلغاء" : "Cancel"}
        </button>
      </motion.div>
    </div>
  );
}

const PaymentGatewaySheet = memo(PaymentGatewaySheetImpl);
export default PaymentGatewaySheet;

