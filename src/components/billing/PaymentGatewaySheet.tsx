/** @doc Payment options menu — real brand marks (Visa, Mastercard, Vodafone Cash). */
import { memo, useEffect, useState } from "react";
import { m as motion } from "framer-motion";
import { CreditCard, ChevronRight, Loader2 } from "lucide-react";
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

/* ---- Real brand marks (inline SVG, official shapes/colors) ---- */

const VISA_PATH =
  "M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z";

const VODAFONE_PATH =
  "M12 0A12 12 0 0 0 0 12A12 12 0 0 0 12 24A12 12 0 0 0 24 12A12 12 0 0 0 12 0M16.25 1.12C16.57 1.12 16.9 1.15 17.11 1.22C14.94 1.67 13.21 3.69 13.22 6C13.22 6.05 13.22 6.11 13.23 6.17C16.87 7.06 18.5 9.25 18.5 12.28C18.54 15.31 16.14 18.64 12.09 18.65C8.82 18.66 5.41 15.86 5.39 11.37C5.38 8.4 7 5.54 9.04 3.85C11.04 2.19 13.77 1.13 16.25 1.12Z";

const VisaMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#1A1F71" d={VISA_PATH} />
  </svg>
);

const MastercardMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 20" className={className} aria-hidden="true">
    <circle cx="12" cy="10" r="8" fill="#EB001B" />
    <circle cx="20" cy="10" r="8" fill="#F79E1B" />
    <path d="M16 3.07A8 8 0 0 1 16 16.93A8 8 0 0 1 16 3.07Z" fill="#FF5F00" />
  </svg>
);

const VodafoneMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#E60000" d={VODAFONE_PATH} />
  </svg>
);

const RowIcon = ({ id }: { id: PayOption }) => {
  if (id === "local") {
    return (
      <span className="flex h-9 w-[54px] shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5">
        <VisaMark className="h-[10px] w-[24px]" />
        <MastercardMark className="-ml-1 h-[11px] w-[18px]" />
      </span>
    );
  }
  if (id === "wallets") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center">
        <VodafoneMark className="h-8 w-8" />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/70">
      <CreditCard className="h-[17px] w-[17px] text-foreground/70" strokeWidth={1.6} />
    </span>
  );
};

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
    subtitle === "Pick an option." && isArabic ? "اختار طريقة الدفع اللي تناسبك." : subtitle;

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

  // Respect the caller's order so the most relevant method comes first
  // (local card before the international card on the Arabic site).
  const visible = options
    ? options
        .map((id) => ROWS.find((row) => row.id === id))
        .filter((row): row is (typeof ROWS)[number] => !!row)
    : ROWS;

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
                <RowIcon id={row.id} />
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
          className="mt-4 h-12 w-full rounded-full text-[15px] font-semibold text-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          {isArabic ? "إلغاء" : "Cancel"}
        </button>
      </motion.div>
    </div>
  );
}

const PaymentGatewaySheet = memo(PaymentGatewaySheetImpl);
export default PaymentGatewaySheet;

