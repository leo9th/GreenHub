import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

const DEBOUNCE_MS = 100;

function scrollCloseThreshold(): number {
  return typeof window !== "undefined" ? window.innerHeight : 0;
}

/**
 * More filters: open at top (`scrollY === 0`); auto-close only after scrolling down
 * past one viewport, and never while focus is inside the filter section.
 */
export function useMoreFiltersScrollSync(
  setOpen: Dispatch<SetStateAction<boolean>>,
  filtersContainerRef: RefObject<HTMLElement | null>,
) {
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevScrollYRef = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const focusInsideFiltersRef = useRef(false);

  const applyScrollRule = useCallback(() => {
    const y = window.scrollY;
    const threshold = scrollCloseThreshold();

    if (y === 0) {
      setOpen(true);
      prevScrollYRef.current = y;
      return;
    }

    const scrollingDown = y > prevScrollYRef.current;
    const shouldClose = y > threshold && scrollingDown && !focusInsideFiltersRef.current;

    if (shouldClose) {
      setOpen(false);
    }

    prevScrollYRef.current = y;
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

  useLayoutEffect(() => {
    const el = filtersContainerRef.current;
    if (!el) return;

    const onFocusIn = () => {
      focusInsideFiltersRef.current = true;
    };
    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!el.contains(document.activeElement)) {
          focusInsideFiltersRef.current = false;
        }
      }, 0);
    };

    el.addEventListener("focusin", onFocusIn);
    el.addEventListener("focusout", onFocusOut);
    return () => {
      el.removeEventListener("focusin", onFocusIn);
      el.removeEventListener("focusout", onFocusOut);
    };
  }, [filtersContainerRef]);

  useEffect(() => {
    prevScrollYRef.current = window.scrollY;
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
