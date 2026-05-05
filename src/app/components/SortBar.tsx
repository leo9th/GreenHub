import { useEffect, useRef, useState } from "react";
import { ArrowUpDown, Check } from "@/app/icons/emojiLucide";
import type { ListingSort } from "../utils/productSearch";
import { LISTING_SORT_OPTIONS } from "../utils/productSearch";

type Props = {
  value: ListingSort;
  onChange: (next: ListingSort) => void;
  /** When set, prepended to the row (e.g. result count). */
  leading?: React.ReactNode;
  className?: string;
  id?: string;
};

export function SortBar({ value, onChange, leading, className = "", id = "listing-sort" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const currentLabel = LISTING_SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Sort";

  return (
    <div
      ref={rootRef}
      className={`flex flex-wrap items-center gap-2 ${leading != null ? "justify-between" : "justify-end"} ${className}`}
    >
      {leading != null ? <div className="min-w-0 shrink text-sm text-gray-600 dark:text-muted-foreground">{leading}</div> : null}
      <div className="relative shrink-0">
        <button
          type="button"
          id={id}
          title={currentLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Sort: ${currentLabel}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#22c55e]/35 bg-white text-[#15803d] shadow-sm transition-colors hover:bg-[#22c55e]/10 focus:outline-none focus:ring-2 focus:ring-[#22c55e]/40 dark:border-emerald-600/40 dark:bg-card dark:text-emerald-400 dark:hover:bg-emerald-950/40"
        >
          <ArrowUpDown className="h-5 w-5" aria-hidden />
        </button>

        {open ? (
          <div
            role="listbox"
            aria-label="Sort listings"
            className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl dark:border-border dark:bg-card"
          >
            {LISTING_SORT_OPTIONS.map((opt) => {
              const selected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-muted ${
                    selected ? "font-semibold text-[#15803d] dark:text-emerald-400" : "font-medium text-gray-800 dark:text-foreground"
                  }`}
                >
                  {selected ? <Check className="h-4 w-4 shrink-0 text-[#22c55e]" aria-hidden /> : <span className="w-4 shrink-0" aria-hidden />}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
