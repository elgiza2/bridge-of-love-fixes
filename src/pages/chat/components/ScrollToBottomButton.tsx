import { memo } from "react";
import { ArrowDown } from "lucide-react";
import { useUserLang } from "@/lib/authI18n";

interface ScrollToBottomButtonProps {
  visible: boolean;
  newMessagesCount: number;
  onClick: () => void;
}

/**
 * Floating "jump to latest" control.
 *
 * The transcript sets `overflow-anchor: none` (the thinking panel is swapped
 * for the answer mid-reply, which otherwise shifts the view), so a reader who
 * scrolls up during a long stream has no browser-driven way back to the live
 * text. This button is that way back.
 */
const ScrollToBottomButtonImpl = ({
  visible,
  newMessagesCount,
  onClick,
}: ScrollToBottomButtonProps) => {
  const ar = useUserLang() === "ar-eg";
  if (!visible) return null;
  const aria = ar ? "انزل لآخر المحادثة" : "Jump to latest";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      title={aria}
      className="sticky bottom-3 z-30 mx-auto flex h-9 w-fit items-center justify-center gap-1.5 rounded-full border-0 bg-transparent px-2 text-muted-foreground/70 shadow-none transition-colors hover:text-foreground"
    >
      <ArrowDown className="h-[15px] w-[15px]" strokeWidth={1.75} />
      {newMessagesCount > 0 && (
        <span className="text-[12.5px] font-medium tabular-nums">{newMessagesCount}</span>
      )}
    </button>
  );
};

export const ScrollToBottomButton = memo(ScrollToBottomButtonImpl);

export default ScrollToBottomButton;
