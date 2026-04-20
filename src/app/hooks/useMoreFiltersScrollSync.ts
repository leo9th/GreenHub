import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

const DEBOUNCE_MS = 100;
/** Collapse when user has scrolled past this amount. */
const SCROLL_DOWN_PX = 10;

/**
 * Scroll-based More filters: collapsed when `scrollY > 10`, expanded when `scrollY === 0`.
 * Debounced; manual toggle works but the next scroll re-applies the rule.
 */
export function useMoreFiltersScrollSync(setOpen: Dispatch<SetStateAction<boolean>>) {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyScrollRule = useCallback(() => {
    const y = window.scrollY;
    if (y > SCROLL_DOWN_PX) {
      setOpen(false);
    } else if (y === 0) {
      setOpen(true);
    }
  }, [setOpen]);

  const onScrollDebounced = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      applyScrollRule();
    }, DEBOUNCE_MS);
  }, [applyScrollRule]);

  useEffect(() => {
    applyScrollRule();

    window.addEventListener("scroll", onScrollDebounced, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScrollDebounced);
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [applyScrollRule, onScrollDebounced]);
}
