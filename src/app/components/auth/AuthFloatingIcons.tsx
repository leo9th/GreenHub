import type { LucideIcon } from "@/app/icons/emojiLucide";
import { Car, Leaf, Package, ShoppingCart, Sprout, Truck } from "@/app/icons/emojiLucide";

type RainColumn = {
  Icon: LucideIcon | "leaf-emoji";
  leftPct: number;
  delaySec: number;
  durationSec: number;
  sizePx: number;
};

/** Subtle vertical “rain” of marketplace icons — legacy auth ambience. */
const COLUMNS: RainColumn[] = [
  { Icon: ShoppingCart, leftPct: 7, delaySec: 0, durationSec: 22, sizePx: 22 },
  { Icon: Car, leftPct: 18, delaySec: -4, durationSec: 28, sizePx: 24 },
  { Icon: "leaf-emoji", leftPct: 29, delaySec: -2, durationSec: 25, sizePx: 20 },
  { Icon: Package, leftPct: 41, delaySec: -7, durationSec: 30, sizePx: 21 },
  { Icon: Leaf, leftPct: 53, delaySec: -1, durationSec: 24, sizePx: 23 },
  { Icon: Truck, leftPct: 64, delaySec: -5, durationSec: 26, sizePx: 24 },
  { Icon: Sprout, leftPct: 76, delaySec: -9, durationSec: 29, sizePx: 22 },
  { Icon: ShoppingCart, leftPct: 88, delaySec: -3, durationSec: 27, sizePx: 20 },
  { Icon: Car, leftPct: 95, delaySec: -6, durationSec: 31, sizePx: 19 },
];

function RainGlyph({ column }: { column: RainColumn }) {
  const { Icon, sizePx } = column;
  if (Icon === "leaf-emoji") {
    return (
      <span className="block select-none leading-none opacity-80" style={{ fontSize: sizePx }}>
        🌿
      </span>
    );
  }
  return (
    <Icon
      className="gh-auth-rain-icon shrink-0 opacity-90"
      strokeWidth={1.35}
      style={{ width: sizePx, height: sizePx }}
    />
  );
}

export function AuthFloatingIcons() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden select-none"
      aria-hidden
    >
      {COLUMNS.map((col, i) => (
        <div
          key={i}
          className="absolute top-0 h-full w-10"
          style={{
            left: `${col.leftPct}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div
            className="gh-auth-rain-strip flex flex-col items-center gap-[min(11vh,92px)] py-6"
            style={{
              animationDuration: `${col.durationSec}s`,
              animationDelay: `${col.delaySec}s`,
            }}
          >
            {[0, 1].map((dup) => (
              <div key={dup} className="flex flex-col items-center gap-[min(11vh,92px)]">
                {Array.from({ length: 5 }).map((_, j) => (
                  <RainGlyph key={j} column={col} />
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
