/**
 * Tiny emoji/CSS stand-ins so this sub-app does not depend on lucide-react.
 */
import {
  forwardRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";

type LucideProps = HTMLAttributes<HTMLSpanElement> & {
  size?: number | string;
  strokeWidth?: number;
};

type LucideIcon = ForwardRefExoticComponent<LucideProps & RefAttributes<HTMLSpanElement>>;

function mk(emoji: string, displayName: string): LucideIcon {
  const C = forwardRef<HTMLSpanElement, LucideProps>(function Icon(props, ref) {
    const { className, size, strokeWidth: _sw, style, children, ...rest } = props;
    const merged: CSSProperties = { ...style };
    if (typeof size === "number") merged.fontSize = size;
    else if (size) merged.fontSize = size;
    return (
      <span
        ref={ref}
        aria-hidden
        className={`inline-flex shrink-0 items-center justify-center leading-none ${className ?? ""}`}
        style={merged}
        {...rest}
      >
        {children ?? emoji}
      </span>
    );
  });
  C.displayName = displayName;
  return C as LucideIcon;
}

export const Loader2 = forwardRef<HTMLSpanElement, LucideProps>(function Loader2(props, ref) {
  const { className, size, strokeWidth: _sw, style, ...rest } = props;
  const dim =
    typeof size === "number"
      ? { width: size, height: size }
      : size && typeof size === "string"
        ? { width: size, height: size }
        : {};
  return (
    <span
      ref={ref}
      role="status"
      aria-label="Loading"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80 ${className ?? ""}`}
      style={{ ...dim, ...style }}
      {...rest}
    />
  );
}) as LucideIcon;
Loader2.displayName = "Loader2";

export const BookOpen = mk("📖", "BookOpen");
export const Search = mk("🔍", "Search");
export const Volume2 = mk("🔊", "Volume2");
export const AlertCircle = mk("⚠️", "AlertCircle");
export const Sparkles = mk("✨", "Sparkles");
