import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Clock, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  fetchProductSearchDictionary,
  type SearchDictionaryEntry,
} from "../utils/productSearchDictionary";
import { normalizedGlobalSearchTerm } from "../utils/productSearch";

const RECENT_STORAGE_KEY = "greenhub-recent-searches";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 300;
const POPULAR_PREVIEW = 12;

function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function pushRecentSearch(term: string): void {
  const t = normalizedGlobalSearchTerm(term);
  if (!t) return;
  try {
    const prev = readRecentSearches().filter((s) => s.toLowerCase() !== t.toLowerCase());
    const next = [t, ...prev].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <span className="font-semibold text-gray-900">{match}</span>
      {after}
    </>
  );
}

export type SmartSearchBarProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  inputId?: string;
  /** Called after user commits a search (Enter / pick); use to persist recents (handled internally) or analytics */
  onSearchCommit?: (term: string) => void;
};

type RowItem = {
  key: string;
  kind: "recent" | "keyword";
  text: string;
  categoryLabel?: string;
};

export default function SmartSearchBar({
  value,
  onChange,
  placeholder = "Search products, sellers, categories, locations…",
  className = "",
  inputId: inputIdProp,
  onSearchCommit,
}: SmartSearchBarProps) {
  const reactId = useId();
  const inputId = inputIdProp ?? `smart-search-${reactId}`;
  const listId = `${inputId}-listbox`;

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState(value);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dictionary, setDictionary] = useState<SearchDictionaryEntry[]>([]);
  const [dictLoading, setDictLoading] = useState(true);
  const [recent, setRecent] = useState<string[]>(() =>
    typeof window !== "undefined" ? readRecentSearches() : [],
  );

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setDictLoading(true);
      const rows = await fetchProductSearchDictionary(supabase, 50);
      if (!cancelled) {
        setDictionary(rows);
        setDictLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const debouncedInput = useDebouncedValue(inputValue, DEBOUNCE_MS);

  useEffect(() => {
    const next = normalizedGlobalSearchTerm(debouncedInput);
    const cur = normalizedGlobalSearchTerm(value);
    if (next !== cur) {
      onChange(debouncedInput);
    }
  }, [debouncedInput, onChange, value]);

  const refreshRecent = useCallback(() => {
    setRecent(readRecentSearches());
  }, []);

  const filterQuery = useMemo(
    () => normalizedGlobalSearchTerm(debouncedInput),
    [debouncedInput],
  );

  const rows: RowItem[] = useMemo(() => {
    const out: RowItem[] = [];
    const q = filterQuery.toLowerCase();

    if (!q) {
      for (const r of recent) {
        out.push({ key: `recent-${r}`, kind: "recent", text: r });
      }
      const popular = dictionary.slice(0, POPULAR_PREVIEW);
      for (const e of popular) {
        out.push({
          key: `kw-${e.term}`,
          kind: "keyword",
          text: e.term,
          categoryLabel: e.categoryLabel,
        });
      }
      return out;
    }

    const seen = new Set<string>();
    for (const r of recent) {
      if (r.toLowerCase().includes(q) && !seen.has(r.toLowerCase())) {
        seen.add(r.toLowerCase());
        out.push({ key: `recent-${r}`, kind: "recent", text: r });
      }
    }
    for (const e of dictionary) {
      if (e.term.toLowerCase().includes(q) && !seen.has(e.term.toLowerCase())) {
        seen.add(e.term.toLowerCase());
        out.push({
          key: `kw-${e.term}`,
          kind: "keyword",
          text: e.term,
          categoryLabel: e.categoryLabel,
        });
        if (out.length >= 24) break;
      }
    }
    return out;
  }, [filterQuery, recent, dictionary]);

  const showDropdown = open && focused;

  useEffect(() => {
    setRecent(readRecentSearches());
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filterQuery, rows.length, open]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const commit = useCallback(
    (term: string) => {
      const t = normalizedGlobalSearchTerm(term);
      setInputValue(term);
      onChange(term);
      pushRecentSearch(t);
      refreshRecent();
      onSearchCommit?.(t);
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    },
    [onChange, onSearchCommit, refreshRecent],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }
    if (!showDropdown && (e.key === "ArrowDown" || e.key === "ArrowUp") && rows.length > 0 && focused) {
      e.preventDefault();
      setOpen(true);
      setActiveIndex(e.key === "ArrowDown" ? 0 : rows.length - 1);
      return;
    }
    if (!showDropdown || rows.length === 0) {
      if (e.key === "Enter") {
        const t = normalizedGlobalSearchTerm(inputValue);
        if (t) {
          commit(inputValue.trim());
        }
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1 >= rows.length ? 0 : i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? rows.length - 1 : i - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < rows.length) {
        commit(rows[activeIndex]!.text);
      } else {
        commit(inputValue.trim());
      }
      return;
    }
  };

  return (
    <div ref={containerRef} className={`relative z-10 ${className}`}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          strokeWidth={2}
          aria-hidden
        />
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={showDropdown ? listId : undefined}
          aria-autocomplete="list"
          placeholder={placeholder}
          autoComplete="off"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            refreshRecent();
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => {
            setFocused(false);
          }}
          onKeyDown={onKeyDown}
          className="w-full rounded-full border border-gray-300 bg-white py-2.5 pl-11 pr-4 text-sm placeholder-gray-500 shadow-sm focus:border-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#22c55e]/20"
        />
      </div>

      {showDropdown ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-gray-200/80 bg-white/95 shadow-2xl backdrop-blur-sm [-webkit-overflow-scrolling:touch]"
        >
          {dictLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Loading suggestions…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">No suggestions match. Press Enter to search.</div>
          ) : (
            rows.map((row, index) => {
              const active = index === activeIndex;
              const Icon = row.kind === "recent" ? Clock : Search;
              return (
                <button
                  key={row.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`flex w-full min-h-[44px] items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    active ? "bg-emerald-50" : "hover:bg-emerald-50"
                  }`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(row.text);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <Icon className="h-4 w-4 shrink-0 text-emerald-600/90" strokeWidth={2} aria-hidden />
                  <span className="min-w-0 flex-1 text-gray-800">
                    <HighlightMatch text={row.text} query={debouncedInput} />
                  </span>
                  {row.categoryLabel ? (
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                      {row.categoryLabel}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

export { pushRecentSearch, readRecentSearches };
