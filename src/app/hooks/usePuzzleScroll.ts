import { useEffect, useRef } from "react";

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
 * Puzzle pan: works even when drag starts on nested links/cards (pointerdown capture + document move/up).
 * Pair with a fixed-height .gh-puzzle-viewport so content can exceed the viewport.
 */
export function usePuzzleScroll(opts: UsePuzzleScrollOptions) {
  const { enabled } = opts;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const { enabled, viewportRef } = optsRef.current;
    const vp = viewportRef.current;
    if (!enabled || !vp) return;

    const state = {
      dragging: false,
      lastX: 0,
      lastY: 0,
      moved: 0,
      vel: { x: 0, y: 0 },
      inertiaRaf: null as number | null,
      pointerId: null as number | null,
    };
    const suppressClickRef = { current: false };

    const getOpts = () => optsRef.current;

    const applyTransform = () => {
      const { contentRef, translateRef } = getOpts();
      const ct = contentRef.current;
      if (!ct) return;
      const { x, y } = translateRef.current;
      ct.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const stopInertia = () => {
      if (state.inertiaRaf != null) {
        cancelAnimationFrame(state.inertiaRaf);
        state.inertiaRaf = null;
      }
    };

    const stepInertia = () => {
      const { translateRef, clampPuzzlePan, runEdgeCheck } = getOpts();
      let { x: vx, y: vy } = state.vel;
      vx *= INERTIA_FRICTION;
      vy *= INERTIA_FRICTION;
      if (Math.abs(vx) < MIN_INERTIA_SPEED) vx = 0;
      if (Math.abs(vy) < MIN_INERTIA_SPEED) vy = 0;
      state.vel = { x: vx, y: vy };

      if (vx === 0 && vy === 0) {
        state.inertiaRaf = null;
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
      state.inertiaRaf = requestAnimationFrame(stepInertia);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!state.dragging) return;
      if (state.pointerId != null && e.pointerId !== state.pointerId) return;

      const { translateRef, clampPuzzlePan, runEdgeCheck, viewportRef } = getOpts();
      e.preventDefault();

      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.moved += Math.abs(dx) + Math.abs(dy);

      translateRef.current = {
        x: translateRef.current.x + dx,
        y: translateRef.current.y + dy,
      };

      const vport = viewportRef.current;
      if (vport) {
        const r = vport.getBoundingClientRect();
        const lx = e.clientX - r.left;
        const ly = e.clientY - r.top;
        if (lx < EDGE_ZONE_PX) translateRef.current.x += EDGE_BOOST;
        if (lx > r.width - EDGE_ZONE_PX) translateRef.current.x -= EDGE_BOOST;
        if (ly < EDGE_ZONE_PX) translateRef.current.y += EDGE_BOOST;
        if (ly > r.height - EDGE_ZONE_PX) translateRef.current.y -= EDGE_BOOST;
      }

      state.vel = {
        x: state.vel.x * 0.35 + dx * 0.65,
        y: state.vel.y * 0.35 + dy * 0.65,
      };

      clampPuzzlePan();
      applyTransform();
      runEdgeCheck();
    };

    const endDrag = (e: PointerEvent) => {
      if (!state.dragging) return;
      if (state.pointerId != null && e.pointerId !== state.pointerId) return;

      const capturedId = state.pointerId;
      state.dragging = false;
      state.pointerId = null;

      if (capturedId != null) {
        try {
          vp.releasePointerCapture(capturedId);
        } catch {
          /* ignore */
        }
      }

      if (state.moved > DRAG_CLICK_THRESHOLD) {
        suppressClickRef.current = true;
      }
      state.moved = 0;

      const { runEdgeCheck } = getOpts();
      const speed = Math.hypot(state.vel.x, state.vel.y);
      if (speed > MIN_INERTIA_SPEED) {
        stopInertia();
        state.inertiaRaf = requestAnimationFrame(stepInertia);
      } else {
        runEdgeCheck();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      stopInertia();
      state.dragging = true;
      state.pointerId = e.pointerId;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.moved = 0;
      state.vel = { x: 0, y: 0 };

      try {
        vp.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onClickCapture = (e: MouseEvent) => {
      if (suppressClickRef.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickRef.current = false;
      }
    };

    vp.addEventListener("pointerdown", onPointerDown, { capture: true });
    document.addEventListener("pointermove", onPointerMove, { capture: true, passive: false });
    document.addEventListener("pointerup", endDrag, { capture: true });
    document.addEventListener("pointercancel", endDrag, { capture: true });
    vp.addEventListener("click", onClickCapture, { capture: true });

    return () => {
      stopInertia();
      vp.removeEventListener("pointerdown", onPointerDown, { capture: true });
      document.removeEventListener("pointermove", onPointerMove, { capture: true });
      document.removeEventListener("pointerup", endDrag, { capture: true });
      document.removeEventListener("pointercancel", endDrag, { capture: true });
      vp.removeEventListener("click", onClickCapture, { capture: true });
    };
  }, [enabled]);
}
