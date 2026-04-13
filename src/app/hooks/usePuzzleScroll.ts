import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

const EDGE_ZONE_PX = 50;
const EDGE_BOOST = 14;
const INERTIA_FRICTION = 0.88;
const MIN_INERTIA_SPEED = 0.35;
const DRAG_CLICK_THRESHOLD = 10;

export type UsePuzzleScrollOptions = {
  enabled: boolean;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  translateRef: React.MutableRefObject<{ x: number; y: number }>;
  runEdgeCheck: () => void;
  clampPuzzlePan: () => void;
};

/**
 * Map / puzzle pan: pointer drag, edge boost while dragging, release inertia.
 * Updates translate on contentRef via translate3d; parent feed uses the same refs for loading.
 */
export function usePuzzleScroll(opts: UsePuzzleScrollOptions) {
  const { enabled, viewportRef, contentRef, translateRef, runEdgeCheck, clampPuzzlePan } = opts;

  const dragging = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const moved = useRef(0);
  const inertiaRaf = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const stopInertia = useCallback(() => {
    if (inertiaRaf.current != null) {
      cancelAnimationFrame(inertiaRaf.current);
      inertiaRaf.current = null;
    }
  }, []);

  const applyTransform = useCallback(() => {
    const ct = contentRef.current;
    if (!ct) return;
    const { x, y } = translateRef.current;
    ct.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, [contentRef, translateRef]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      stopInertia();
      dragging.current = true;
      moved.current = 0;
      suppressClick.current = false;
      last.current = { x: e.clientX, y: e.clientY };
      vel.current = { x: 0, y: 0 };
      const vp = viewportRef.current;
      if (vp) {
        try {
          vp.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [enabled, stopInertia, viewportRef],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || !dragging.current) return;
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
      moved.current += Math.abs(dx) + Math.abs(dy);

      translateRef.current = {
        x: translateRef.current.x + dx,
        y: translateRef.current.y + dy,
      };

      const vp = viewportRef.current;
      if (vp) {
        const r = vp.getBoundingClientRect();
        const lx = e.clientX - r.left;
        const ly = e.clientY - r.top;
        if (lx < EDGE_ZONE_PX) translateRef.current.x += EDGE_BOOST;
        if (lx > r.width - EDGE_ZONE_PX) translateRef.current.x -= EDGE_BOOST;
        if (ly < EDGE_ZONE_PX) translateRef.current.y += EDGE_BOOST;
        if (ly > r.height - EDGE_ZONE_PX) translateRef.current.y -= EDGE_BOOST;
      }

      vel.current = {
        x: vel.current.x * 0.35 + dx * 0.65,
        y: vel.current.y * 0.35 + dy * 0.65,
      };

      clampPuzzlePan();
      applyTransform();
      runEdgeCheck();
    },
    [enabled, viewportRef, translateRef, clampPuzzlePan, applyTransform, runEdgeCheck],
  );

  const stepInertia = useCallback(() => {
    let { x: vx, y: vy } = vel.current;
    vx *= INERTIA_FRICTION;
    vy *= INERTIA_FRICTION;
    if (Math.abs(vx) < MIN_INERTIA_SPEED) vx = 0;
    if (Math.abs(vy) < MIN_INERTIA_SPEED) vy = 0;
    vel.current = { x: vx, y: vy };

    if (vx === 0 && vy === 0) {
      inertiaRaf.current = null;
      runEdgeCheck();
      return;
    }

    translateRef.current = {
      x: translateRef.current.x + vx,
      y: translateRef.current.y + vy,
    };
    clampPuzzlePan();
    applyTransform();
    runEdgeCheck();
    inertiaRaf.current = requestAnimationFrame(stepInertia);
  }, [translateRef, clampPuzzlePan, applyTransform, runEdgeCheck]);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (!dragging.current) return;
      dragging.current = false;
      const vp = viewportRef.current;
      if (vp) {
        try {
          vp.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (moved.current > DRAG_CLICK_THRESHOLD) {
        suppressClick.current = true;
      }
      moved.current = 0;

      const speed = Math.hypot(vel.current.x, vel.current.y);
      if (speed > MIN_INERTIA_SPEED) {
        stopInertia();
        inertiaRaf.current = requestAnimationFrame(stepInertia);
      } else {
        runEdgeCheck();
      }
    },
    [enabled, viewportRef, stepInertia, stopInertia, runEdgeCheck],
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      dragging.current = false;
      const vp = viewportRef.current;
      if (vp) {
        try {
          vp.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [viewportRef],
  );

  const onClickCapture = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (suppressClick.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClick.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      stopInertia();
    };
  }, [stopInertia]);

  const puzzleProps = enabled
    ? {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onLostPointerCapture: onPointerCancel,
        onClickCapture,
        style: { touchAction: "none" as const },
      }
    : {};

  return { puzzleProps };
}
