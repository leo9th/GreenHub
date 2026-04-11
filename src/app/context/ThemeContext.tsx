import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "greenhub-theme";

export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme;
  /** null means follow system until user toggles */
  preference: ResolvedTheme | null;
  setTheme: (t: ResolvedTheme) => void;
  toggleTheme: () => void;
};

function getSystemDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStored(): ResolvedTheme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
    return null;
  } catch {
    return null;
  }
}

function resolveTheme(preference: ResolvedTheme | null, systemDark: boolean): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

function applyHtmlClass(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ResolvedTheme | null>(() =>
    typeof window !== "undefined" ? readStored() : null,
  );
  const [systemDark, setSystemDark] = useState(() => getSystemDark());

  const resolvedTheme = useMemo(
    () => resolveTheme(preference, systemDark),
    [preference, systemDark],
  );

  useLayoutEffect(() => {
    applyHtmlClass(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    setPreferenceState(readStored());
  }, []);

  useEffect(() => {
    if (preference !== null) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setSystemDark(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [preference]);

  const setTheme = useCallback((t: ResolvedTheme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    setPreferenceState(t);
    applyHtmlClass(t);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      resolvedTheme,
      preference,
      setTheme,
      toggleTheme,
    }),
    [resolvedTheme, preference, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
