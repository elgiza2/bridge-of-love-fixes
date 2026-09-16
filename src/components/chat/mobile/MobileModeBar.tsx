import { m as motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  FileText,
  Microscope,
  Presentation,
  Image as ImageIcon,
  Code2,
  X,
  type LucideIcon,
} from "lucide-react";
import { haptic } from "@/lib/haptics";
import { translateExactText, useUserLang } from "@/lib/authI18n";

export type LumaMode =
  | "normal"
  | "learning"
  | "deep-research"
  | "slides"
  | "operator"
  | "docs"
  | "images"
  | "video"
  | "code";

type ModeDef = {
  id: Exclude<LumaMode, "normal">;
  label: string;
  Icon: LucideIcon;
  color: string;
};

// One distinct hue per mode — makes the active state instantly recognisable
// and keeps the resting chip strip lively without a wall of yellow.
const MODES: ModeDef[] = [
  { id: "code", label: "Coder Mode", Icon: Code2, color: "var(--mode-code)" },
  { id: "images", label: "Images", Icon: ImageIcon, color: "hsl(var(--brand-mint))" },
  { id: "slides", label: "Slides", Icon: Presentation, color: "var(--mode-slides)" },
  {
    id: "deep-research",
    label: "Deep Research",
    Icon: Microscope,
    color: "hsl(var(--brand-blush))",
  },
  { id: "docs", label: "Docs", Icon: FileText, color: "var(--mode-docs)" },
  { id: "learning", label: "Learning", Icon: GraduationCap, color: "var(--mode-learning)" },
];

// Color-mix tint helper — works with hex, hsl(var(--…)), or any CSS color.
// (the previous hex-only parser produced rgba(NaN,NaN,NaN,…) for CSS-var
// colors, which made shadows silently invalid and chips look inconsistent.)
const tint = (color: string, a: number) =>
  `color-mix(in srgb, ${color} ${Math.round(a * 100)}%, transparent)`;

interface Props {
  mode: LumaMode;
  onChange: (mode: LumaMode) => void;
}

const TAP_SPRING = { type: "spring" as const, stiffness: 420, damping: 26 };

export default function MobileModeBar({ mode, onChange }: Props) {
  const lang = useUserLang();
  const tx = (text: string) => translateExactText(text, lang);
  const activeMode = mode !== "normal" ? MODES.find((m) => m.id === mode) : null;

  return (
    <div
      data-testid="mobile-mode-bar"
      dir="ltr"
      // Soft pills on one quiet strip: no boxy borders, each mode carries its
      // own hue only on the icon so the row stays calm, and the row scrolls
      // with breathing room at both ends (the last chip used to be clipped).
      className="flex items-center gap-2 overflow-x-auto no-scrollbar ps-3 pe-6 pb-2.5 min-h-[38px]"
      style={{ WebkitOverflowScrolling: "touch", scrollSnapType: "x proximity" }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {activeMode ? (
          <motion.div
            key={activeMode.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={TAP_SPRING}
            data-testid={`mobile-mode-${activeMode.id}`}
            data-active={true}
            style={{
              scrollSnapAlign: "start",
              backgroundColor: tint(activeMode.color, 0.16),
              color: activeMode.color,
              boxShadow: `inset 0 0 0 1px ${tint(activeMode.color, 0.34)}`,
            }}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 ps-3.5 pe-1 rounded-full text-[13.5px] font-semibold"
          >
            <activeMode.Icon size={16} strokeWidth={2.2} />
            <span className="leading-none whitespace-nowrap">{tx(activeMode.label)}</span>
            <button
              type="button"
              aria-label={tx(`Remove ${activeMode.label} mode`)}
              onClick={() => {
                haptic("soft");
                onChange("normal");
              }}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full transition-opacity hover:opacity-70"
              style={{ backgroundColor: tint(activeMode.color, 0.2) }}
            >
              <X size={13} strokeWidth={2.8} />
            </button>
          </motion.div>
        ) : (
          MODES.map(({ id, label, Icon, color }, i) => (
            <motion.button
              key={id}
              type="button"
              data-testid={`mobile-mode-${id}`}
              data-active={false}
              onClick={() => {
                haptic("tap");
                onChange(id);
              }}
              whileTap={{ scale: 0.96 }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 4 }}
              transition={{ ...TAP_SPRING, delay: i * 0.02 }}
              style={{ scrollSnapAlign: "start" }}
              className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-foreground/[0.05] text-[13.5px] font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.09] active:bg-foreground/[0.12]"
            >
              <Icon size={16} strokeWidth={2.2} style={{ color }} />
              <span className="leading-none whitespace-nowrap">{tx(label)}</span>
            </motion.button>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
