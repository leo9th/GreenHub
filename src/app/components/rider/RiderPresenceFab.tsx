import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Bike, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { useRiderPresence } from "../../hooks/useRiderPresence";

type Pos = { x: number; y: number };
type Edge = "left" | "right";
type SavedFabPos = { x: number; y: number; edge: Edge };
const STORAGE_KEY = "gh_rider_presence_fab_pos";
const FAB_SIZE_PX = 72;
const FAB_MIN_X_PX = 8;
const FAB_MIN_Y_PX = 80;
const LONG_PRESS_MS = 200;
const DRAG_START_THRESHOLD_PX = 5;

function clampPos(pos: Pos): Pos {
  if (typeof window === "undefined") return pos;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.min(Math.max(FAB_MIN_X_PX, pos.x), Math.max(FAB_MIN_X_PX, w - FAB_SIZE_PX)),
    y: Math.min(Math.max(FAB_MIN_Y_PX, pos.y), Math.max(FAB_MIN_Y_PX, h - FAB_SIZE_PX)),
  };
}

export default function RiderPresenceFab() {
  const navigate = useNavigate();
  const { hasUser, role, isRider, isOnline, toggleAvailability, lastLocation, onlineSince, error, isBusy } = useRiderPresence();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [edge, setEdge] = useState<Edge>("left");
  const [pos, setPos] = useState<Pos>(() => {
    if (typeof window === "undefined") return { x: 16, y: 220 };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { x: 16, y: 220 };
      const parsed = JSON.parse(raw) as Partial<SavedFabPos>;
      if (typeof parsed?.x !== "number" || typeof parsed?.y !== "number") return { x: 16, y: 220 };
      return clampPos({ x: parsed.x, y: parsed.y });
    } catch {
      return { x: 16, y: 220 };
    }
  });
  const edgeRef = useRef<Edge>("left");
  const dragRef = useRef<{
    pressed: boolean;
    longPressReady: boolean;
    dragging: boolean;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    timerId: ReturnType<typeof setTimeout> | null;
    moveCleanup: (() => void) | null;
  }>({
    pressed: false,
    longPressReady: false,
    dragging: false,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    timerId: null,
    moveCleanup: null,
  });
  const suppressClickRef = useRef(false);

  const persistPos = (next: Pos, nextEdge: Edge) => {
    if (typeof window === "undefined") return;
    const payload: SavedFabPos = { x: next.x, y: next.y, edge: nextEdge };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  };

  const snapToEdge = (draft: Pos): { snapped: Pos; nextEdge: Edge } => {
    if (typeof window === "undefined") return { snapped: draft, nextEdge: edgeRef.current };
    const w = window.innerWidth;
    const h = window.innerHeight;
    const nextEdge: Edge = draft.x + FAB_SIZE_PX / 2 < w / 2 ? "left" : "right";
    const snapped = clampPos({
      x: nextEdge === "left" ? FAB_MIN_X_PX : Math.max(FAB_MIN_X_PX, w - FAB_SIZE_PX),
      y: Math.min(Math.max(FAB_MIN_Y_PX, draft.y), Math.max(FAB_MIN_Y_PX, h - FAB_SIZE_PX)),
    });
    return { snapped, nextEdge };
  };

  const moveDrag = (clientX: number, clientY: number) => {
    const st = dragRef.current;
    if (!st.pressed) return;
    const dx = clientX - st.startX;
    const dy = clientY - st.startY;
    const distance = Math.hypot(dx, dy);

    if (!st.dragging) {
      if (!st.longPressReady || distance <= DRAG_START_THRESHOLD_PX) return;
      st.dragging = true;
      setIsDragging(true);
    }

    setPos(
      clampPos({
        x: clientX - st.offsetX,
        y: clientY - st.offsetY,
      }),
    );
  };

  const endDrag = () => {
    const st = dragRef.current;
    if (st.timerId) {
      clearTimeout(st.timerId);
      st.timerId = null;
    }
    st.moveCleanup?.();
    st.moveCleanup = null;

    if (st.dragging) {
      const { snapped, nextEdge } = snapToEdge(pos);
      setPos(snapped);
      setEdge(nextEdge);
      edgeRef.current = nextEdge;
      persistPos(snapped, nextEdge);
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    st.pressed = false;
    st.longPressReady = false;
    st.dragging = false;
    setIsDragging(false);
  };

  const beginPress = (clientX: number, clientY: number) => {
    const st = dragRef.current;
    st.pressed = true;
    st.longPressReady = false;
    st.dragging = false;
    st.startX = clientX;
    st.startY = clientY;
    st.offsetX = clientX - pos.x;
    st.offsetY = clientY - pos.y;
    if (st.timerId) clearTimeout(st.timerId);
    st.timerId = window.setTimeout(() => {
      st.longPressReady = true;
    }, LONG_PRESS_MS);
  };

  const onMouseDown = (e: { clientX: number; clientY: number }) => {
    beginPress(e.clientX, e.clientY);
    const handleMove = (ev: MouseEvent) => moveDrag(ev.clientX, ev.clientY);
    const handleUp = () => endDrag();
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp, { once: true });
    dragRef.current.moveCleanup = () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  };

  const onTouchStart = (e: { touches: Array<{ clientX: number; clientY: number }> }) => {
    const touch = e.touches[0];
    if (!touch) return;
    beginPress(touch.clientX, touch.clientY);
    const handleMove = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (!t) return;
      moveDrag(t.clientX, t.clientY);
      if (dragRef.current.dragging) ev.preventDefault();
    };
    const handleEnd = () => endDrag();
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd, { once: true });
    window.addEventListener("touchcancel", handleEnd, { once: true });
    dragRef.current.moveCleanup = () => {
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      const clamped = clampPos(pos);
      const snappedX =
        edgeRef.current === "left"
          ? FAB_MIN_X_PX
          : Math.max(FAB_MIN_X_PX, window.innerWidth - FAB_SIZE_PX);
      const next = clampPos({ x: snappedX, y: clamped.y });
      setPos(next);
      persistPos(next, edgeRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SavedFabPos>;
      const restoredEdge: Edge = parsed.edge === "right" ? "right" : "left";
      setEdge(restoredEdge);
      edgeRef.current = restoredEdge;
    } catch {
      setEdge("left");
      edgeRef.current = "left";
    }
  }, []);

  if (!hasUser) return null;

  return (
    <div
      className="fixed z-[80]"
      style={{ left: `${pos.x}px`, top: `${pos.y}px`, touchAction: "manipulation" }}
    >
      <motion.button
        type="button"
        disabled={isBusy && isPanelOpen}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onClick={() => {
          if (isDragging || suppressClickRef.current) return;
          if (!isRider) {
            navigate("/book");
            return;
          }
          setIsPanelOpen((v) => !v);
        }}
        className={`group flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg backdrop-blur-sm transition ${
          isRider
            ? isOnline
              ? "border-emerald-400/50 bg-emerald-950/85 text-emerald-100 drop-shadow-[0_0_12px_rgba(16,185,129,0.45)]"
              : "border-slate-600 bg-slate-900/90 text-slate-200"
            : "border-indigo-400/40 bg-indigo-950/85 text-indigo-100"
        }`}
        title={isRider ? (isOnline ? "On Duty" : "Offline") : "Request Ride"}
        animate={isRider && isOnline ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={isRider && isOnline ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        whileTap={{ scale: 0.95 }}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            isRider
              ? isOnline
                ? "bg-emerald-500/25 text-emerald-300"
                : "bg-slate-700 text-slate-300"
              : "bg-indigo-500/25 text-indigo-300"
          }`}
        >
          <Bike className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 text-left">
          <span className="block text-[11px] font-semibold leading-tight">
            {isRider ? (isOnline ? "On Duty" : "Offline") : "Request Ride"}
          </span>
          <span className="block text-[10px] opacity-80 leading-tight">
            {!isRider ? (
              "Tap to book"
            ) : lastLocation ? (
              <>
                <MapPin className="mr-1 inline h-3 w-3" aria-hidden />
                {lastLocation.lat.toFixed(4)}, {lastLocation.lng.toFixed(4)}
              </>
            ) : onlineSince ? (
              new Date(onlineSince).toLocaleTimeString()
            ) : (
              "Tap to toggle"
            )}
          </span>
        </span>
      </motion.button>
      {isPanelOpen && isRider ? (
        <div className="mt-2 w-64 rounded-2xl border border-slate-700 bg-slate-950/95 p-3 text-xs text-slate-200 shadow-xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold text-slate-100">Rider presence</p>
            <button
              type="button"
              onClick={() => setIsPanelOpen(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p>
            Status: <span className={isOnline ? "text-emerald-300" : "text-slate-400"}>{isOnline ? "Online" : "Offline"}</span>
          </p>
          {!isRider ? <p className="mt-1 text-[10px] text-amber-300">Rider account approval required to go online.</p> : null}
          <p className="mt-1 text-slate-400">
            Last update: {onlineSince ? new Date(onlineSince).toLocaleTimeString() : "—"}
          </p>
          <p className="mt-1 text-slate-400">
            Coordinates: {lastLocation ? `${lastLocation.lat.toFixed(5)}, ${lastLocation.lng.toFixed(5)}` : "No fix yet"}
          </p>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                navigator.vibrate(18);
              }
              void toggleAvailability();
            }}
            className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold ${
              isOnline ? "bg-rose-700 text-white hover:bg-rose-600" : "bg-emerald-700 text-white hover:bg-emerald-600"
            } disabled:opacity-60`}
          >
            {isBusy ? "Updating..." : isOnline ? "Go offline" : "Go online"}
          </button>
          <p className="mt-2 text-[10px] text-slate-500">Tip: drag to move this button.</p>
        </div>
      ) : null}
    </div>
  );
}
