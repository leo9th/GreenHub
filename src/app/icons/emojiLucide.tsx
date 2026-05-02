/**
 * Lightweight stand-ins for lucide-react icons (emoji / CSS spinner).
 * Keeps the same component names so call sites need only change the import path.
 */
import {
  forwardRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";

export type LucideProps = HTMLAttributes<HTMLSpanElement> & {
  size?: number | string;
  strokeWidth?: number;
};

export type LucideIcon = ForwardRefExoticComponent<LucideProps & RefAttributes<HTMLSpanElement>>;

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

export const AlertCircle = mk("⚠️", "AlertCircle");
export const ArrowDown = mk("⬇️", "ArrowDown");
export const ArrowLeft = mk("←", "ArrowLeft");
export const ArrowRight = mk("→", "ArrowRight");
export const ArrowUpDown = mk("↕️", "ArrowUpDown");
export const ArrowUpRight = mk("↗️", "ArrowUpRight");
export const BadgeCheck = mk("✅", "BadgeCheck");
export const Ban = mk("🚫", "Ban");
export const BarChart2 = mk("📊", "BarChart2");
export const BarChart3 = mk("📊", "BarChart3");
export const Bell = mk("🔔", "Bell");
export const Bike = mk("🚲", "Bike");
export const Book = mk("📖", "Book");
export const Bot = mk("🤖", "Bot");
export const Briefcase = mk("💼", "Briefcase");
export const Building = mk("🏢", "Building");
export const Building2 = mk("🏢", "Building2");
export const CalendarDays = mk("📅", "CalendarDays");
export const Camera = mk("📷", "Camera");
export const Car = mk("🚗", "Car");
export const Check = mk("✓", "Check");
export const CheckCheck = mk("✓✓", "CheckCheck");
export const CheckCircle = mk("✅", "CheckCircle");
export const CheckCircle2 = mk("✅", "CheckCircle2");
export const ChevronDown = mk("▼", "ChevronDown");
export const ChevronLeft = mk("◀", "ChevronLeft");
export const ChevronRight = mk("▶", "ChevronRight");
export const ChevronUp = mk("▲", "ChevronUp");
export const ClipboardList = mk("📋", "ClipboardList");
export const Clock = mk("🕐", "Clock");
export const Clock3 = mk("🕒", "Clock3");
export const CircleDollarSign = mk("💲", "CircleDollarSign");
export const Copy = mk("📋", "Copy");
export const CreditCard = mk("💳", "CreditCard");
export const DollarSign = mk("$", "DollarSign");
export const Edit = mk("✏️", "Edit");
export const Edit3 = mk("✏️", "Edit3");
export const Eraser = mk("🧹", "Eraser");
export const Eye = mk("👁", "Eye");
export const EyeOff = mk("🙈", "EyeOff");
export const ExternalLink = mk("🔗", "ExternalLink");
export const Filter = mk("🔽", "Filter");
export const Flag = mk("🚩", "Flag");
export const Forward = mk("↪️", "Forward");
export const Grid3x3 = mk("▦", "Grid3x3");
export const Heart = mk("❤️", "Heart");
export const HelpCircle = mk("❓", "HelpCircle");
export const Home = mk("🏠", "Home");
export const ImagePlus = mk("🖼️", "ImagePlus");
export const Info = mk("ℹ️", "Info");
export const Laptop = mk("💻", "Laptop");
export const LayoutDashboard = mk("📐", "LayoutDashboard");
export const Leaf = mk("🍃", "Leaf");
export const Lock = mk("🔒", "Lock");
export const LogOut = mk("🚪", "LogOut");
export const Mail = mk("✉️", "Mail");
export const MapPin = mk("📍", "MapPin");
export const Maximize2 = mk("⛶", "Maximize2");
export const Megaphone = mk("📣", "Megaphone");
export const Menu = mk("☰", "Menu");
export const MessageCircle = mk("💬", "MessageCircle");
export const MessageSquare = mk("💬", "MessageSquare");
export const Mic = mk("🎤", "Mic");
export const Minimize2 = mk("⛶", "Minimize2");
export const Minus = mk("−", "Minus");
export const MoreHorizontal = mk("⋯", "MoreHorizontal");
export const MoreVertical = mk("⋮", "MoreVertical");
export const Navigation = mk("🧭", "Navigation");
export const Package = mk("📦", "Package");
export const Paperclip = mk("📎", "Paperclip");
export const Pencil = mk("✏️", "Pencil");
export const Phone = mk("📞", "Phone");
export const PhoneCall = mk("📞", "PhoneCall");
export const Pin = mk("📌", "Pin");
export const Plus = mk("+", "Plus");
export const RefreshCw = mk("🔄", "RefreshCw");
export const Reply = mk("↩️", "Reply");
export const RotateCcw = mk("↺", "RotateCcw");
export const Save = mk("💾", "Save");
export const Search = mk("🔍", "Search");
export const Settings = mk("⚙️", "Settings");
export const Send = mk("➤", "Send");
export const Share2 = mk("↗", "Share2");
export const Shield = mk("🛡️", "Shield");
export const ShieldAlert = mk("⚠️", "ShieldAlert");
export const ShieldCheck = mk("🛡️", "ShieldCheck");
export const ShoppingBag = mk("🛍️", "ShoppingBag");
export const ShoppingCart = mk("🛒", "ShoppingCart");
export const SlidersHorizontal = mk("🎚️", "SlidersHorizontal");
export const Smartphone = mk("📱", "Smartphone");
export const Smile = mk("😊", "Smile");
export const Sofa = mk("🛋️", "Sofa");
export const Sparkles = mk("✨", "Sparkles");
export const Sprout = mk("🌱", "Sprout");
export const Star = mk("⭐", "Star");
export const Store = mk("🏪", "Store");
export const ThumbsDown = mk("👎", "ThumbsDown");
export const ThumbsUp = mk("👍", "ThumbsUp");
export const Trash2 = mk("🗑️", "Trash2");
export const TrendingUp = mk("📈", "TrendingUp");
export const Trophy = mk("🏆", "Trophy");
export const Truck = mk("🚚", "Truck");
export const Tv = mk("📺", "Tv");
export const Upload = mk("⬆️", "Upload");
export const User = mk("👤", "User");
export const UserCheck = mk("✅", "UserCheck");
export const UserPen = mk("🖊️", "UserPen");
export const UserPlus = mk("➕", "UserPlus");
export const Users = mk("👥", "Users");
export const Vault = mk("🏦", "Vault");
export const Wallet = mk("👛", "Wallet");
export const Watch = mk("⌚", "Watch");
export const Shirt = mk("👕", "Shirt");
export const X = mk("✕", "X");
export const XCircle = mk("❌", "XCircle");

/** Small hollow circle for menus / radios */
export const CircleIcon = mk("○", "CircleIcon");

export const CheckIcon = Check;
export const ChevronDownIcon = ChevronDown;
export const ChevronUpIcon = ChevronUp;
export const ChevronLeftIcon = ChevronLeft;
export const ChevronRightIcon = ChevronRight;
export const SearchIcon = Search;
export const XIcon = X;
export const MinusIcon = Minus;
export const MoreHorizontalIcon = MoreHorizontal;
export const GripVerticalIcon = mk("⋮", "GripVerticalIcon");
export const PanelLeftIcon = mk("☰", "PanelLeftIcon");
