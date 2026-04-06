import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Loader2,
  Search,
  Volume2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { fetchWord, type DictionaryEntry, type DictionaryMeaning } from "./api/dictionary";

const SUGGEST_DEBOUNCE_MS = 180;
const MAX_SUGGESTIONS = 10;

/** First index in sorted `words` where words[i] >= prefix (lexicographic). */
function lowerBound(words: string[], prefix: string): number {
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid]! < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function prefixSuggestions(words: string[], prefix: string, limit: number): string[] {
  if (prefix.length < 2) return [];
  const start = lowerBound(words, prefix);
  const out: string[] = [];
  for (let i = start; i < words.length && out.length < limit; i++) {
    const w = words[i]!;
    if (!w.startsWith(prefix)) break;
    out.push(w);
  }
  return out;
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function pickAudioUrl(entry: DictionaryEntry): string | null {
  for (const p of entry.phonetics ?? []) {
    if (p.audio && p.audio.trim()) {
      const u = p.audio.trim();
      return u.startsWith("//") ? `https:${u}` : u;
    }
  }
  return null;
}

function pickPhonetic(entry: DictionaryEntry): string | null {
  if (entry.phonetic?.trim()) return entry.phonetic.trim();
  for (const p of entry.phonetics ?? []) {
    if (p.text?.trim()) return p.text.trim();
  }
  return null;
}

async function loadWordBank(): Promise<string[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}common-words.txt`);
  if (!res.ok) return [];
  const text = await res.text();
  const set = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const w = line.trim().toLowerCase();
    if (w.length >= 2 && /^[a-z-]+$/.test(w)) set.add(w);
  }
  return [...set].sort();
}

export default function App() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, SUGGEST_DEBOUNCE_MS);
  const [wordBank, setWordBank] = useState<string[] | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const [entries, setEntries] = useState<DictionaryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadWordBank().then(setWordBank);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const debouncedNorm = debouncedQuery.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (!wordBank || debouncedNorm.length < 2) return [];
    return prefixSuggestions(wordBank, debouncedNorm, MAX_SUGGESTIONS);
  }, [wordBank, debouncedNorm]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [debouncedNorm, suggestions.length]);

  const runLookup = useCallback(async (raw: string) => {
    const word = raw.trim().toLowerCase();
    if (!word) return;
    setQuery(word);
    setSuggestionsOpen(false);
    setLoading(true);
    setError(null);
    setEntries(null);
    try {
      const data = await fetchWord(word);
      if (data.length === 0) {
        setError(`No entry found for “${word}”. Try another spelling.`);
        setEntries([]);
      } else {
        setEntries(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setEntries(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setSuggestionsOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const w = suggestions[highlightIndex] ?? normalizedQuery;
    if (w) void runLookup(w);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!suggestionsOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      setSuggestionsOpen(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/40 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-6 sm:py-8">
          <div className="flex items-center gap-2 text-indigo-600">
            <BookOpen className="h-6 w-6" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-widest">Free Dictionary API</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Word dictionary
          </h1>
          <p className="max-w-xl text-sm text-slate-600">
            Type a word for suggestions, then choose one or press Enter. Definitions load from{" "}
            <span className="font-medium text-slate-800">dictionaryapi.dev</span>.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <form onSubmit={onSubmit} className="relative z-10">
          <div ref={wrapRef} className="relative">
            <label htmlFor="dict-search" className="sr-only">
              Search a word
            </label>
            <div className="flex rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 ring-1 ring-slate-100 transition focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-200">
              <div className="flex items-center pl-4 text-slate-400">
                <Search className="h-5 w-5" aria-hidden />
              </div>
              <input
                id="dict-search"
                ref={inputRef}
                type="search"
                autoComplete="off"
                spellCheck="true"
                placeholder="Try “ephemeral”, “quintessential”…"
                className="min-w-0 flex-1 bg-transparent px-3 py-4 text-base text-slate-900 placeholder:text-slate-400 outline-none"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSuggestionsOpen(true);
                }}
                onFocus={() => setSuggestionsOpen(true)}
                onKeyDown={onKeyDown}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen && suggestions.length > 0}
                aria-controls="word-suggestions"
                aria-activedescendant={
                  suggestionsOpen && suggestions[highlightIndex]
                    ? `suggest-${suggestions[highlightIndex]}`
                    : undefined
                }
              />
              <button
                type="submit"
                className="m-2 shrink-0 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50"
                disabled={loading || !normalizedQuery}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : "Look up"}
              </button>
            </div>

            {suggestionsOpen && suggestions.length > 0 ? (
              <ul
                id="word-suggestions"
                role="listbox"
                className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
              >
                {suggestions.map((w, i) => (
                  <li key={w} role="presentation">
                    <button
                      type="button"
                      id={`suggest-${w}`}
                      role="option"
                      aria-selected={i === highlightIndex}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm ${
                        i === highlightIndex ? "bg-indigo-50 text-indigo-900" : "text-slate-800 hover:bg-slate-50"
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void runLookup(w)}
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                      <span className="font-medium">{w}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </form>

        {!wordBank ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading word suggestions…
          </p>
        ) : null}

        {error ? (
          <div
            className="mt-8 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
            <p className="text-sm leading-relaxed">{error}</p>
          </div>
        ) : null}

        {entries && entries.length > 0 ? (
          <div className="mt-10 space-y-8">
            {entries.map((entry, ei) => (
              <article
                key={`${entry.word}-${ei}`}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40"
              >
                <div className="border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 to-white px-6 py-5 sm:px-8">
                  <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold capitalize tracking-tight text-slate-900">{entry.word}</h2>
                      {pickPhonetic(entry) ? (
                        <p className="mt-1 font-mono text-sm text-indigo-700/90">{pickPhonetic(entry)}</p>
                      ) : (
                        <p className="mt-1 text-sm text-slate-400">Pronunciation not listed</p>
                      )}
                    </div>
                    {pickAudioUrl(entry) ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                        onClick={() => {
                          const url = pickAudioUrl(entry);
                          if (url) void new Audio(url).play();
                        }}
                      >
                        <Volume2 className="h-4 w-4" aria-hidden />
                        Play audio
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 px-6 py-2 sm:px-8">
                  {entry.meanings.map((meaning: DictionaryMeaning, mi) => (
                    <section key={`${meaning.partOfSpeech}-${mi}`} className="py-6 first:pt-4 last:pb-6">
                      <h3 className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                        {meaning.partOfSpeech}
                      </h3>
                      <ol className="mt-4 space-y-5">
                        {meaning.definitions.map((def, di) => (
                          <li key={di} className="text-sm leading-relaxed text-slate-800">
                            <p className="font-medium text-slate-900">{def.definition}</p>
                            {def.example ? (
                              <p className="mt-2 border-l-2 border-indigo-200 pl-3 italic text-slate-600">
                                <span className="not-italic font-semibold text-slate-500">Example: </span>
                                {def.example}
                              </p>
                            ) : (
                              <p className="mt-2 text-xs text-slate-400">No example sentence for this sense.</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}

      </main>

      <footer className="mx-auto max-w-3xl px-4 py-10 text-center text-xs text-slate-400">
        Definitions provided by{" "}
        <a
          href="https://dictionaryapi.dev"
          className="text-indigo-600 underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Free Dictionary API
        </a>
        . Suggestions use a local word list; lookups always hit the API.
      </footer>
    </div>
  );
}
