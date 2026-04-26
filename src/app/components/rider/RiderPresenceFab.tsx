import { useEffect, useRef, useState } from "react";
import { Bike, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { useRiderPresence } from "../../hooks/useRiderPresence";

type Pos = { x: number; y: number };
const STORAGE_KEY = "gh_rider_presence_fab_pos";
const LONG_PRESS_MS = 140;
const DRAG_MOVE_THRESHOLD_PX = 6;

function clampPos(pos: Pos): Pos {
  if (typeof window === "undefined") return pos;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.min(Math.max(8, pos.x), Math.max(8, w - 72)),
    y: Math.min(Math.max(80, pos.y), Math.max(80, h - 72)),
  };
}

export default function RiderPresenceFab() {
  const { hasUser, isRider, isOnline, toggleAvailability, lastLocation, onlineSince, error, isBusy } = useRiderPresence();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [pos, setPos] = useState<Pos>(() => {
    if (typeof window === "undefined") return { x: 16, y: 220 };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { x: 16, y: 220 };
      const parsed = JSON.parse(raw) as Pos;
      return clampPos(parsed);
    } catch {
      return { x: 16, y: 220 };
    }
  });
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    pointerId: number | null;
    downClientX: number;
    downClientY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    pointerId: null,
    downClientX: 0,
    downClientY: 0,
  });
  const movedRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setPos((p) => clampPos(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  }, [pos]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  if (!hasUser) return null;

  return (
    <div
      className="fixed z-[80]"
      style={{ left: `${pos.x}px`, top: `${pos.y}px`, touchAction: "none" }}
      onPointerDown={(e) => {
        dragRef.current = {
          active: false,
          startX: e.clientX - pos.x,
          startY: e.clientY - pos.y,
          pointerId: e.pointerId,
          downClientX: e.clientX,
          downClientY: e.clientY,
        };
        movedRef.current = false;
        (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = setTimeout(() => {
          dragRef.current.active = true;
        }, LONG_PRESS_MS);
      }}
      onPointerMove={(e) => {
        if (dragRef.current.pointerId !== e.pointerId) return;
        if (!dragRef.current.active) {
          const movedX = e.clientX - dragRef.current.downClientX;
          const movedY = e.clientY - dragRef.current.downClientY;
          const movedDistance = Math.hypot(movedX, movedY);
          if (movedDistance >= DRAG_MOVE_THRESHOLD_PX) {
            dragRef.current.active = true;
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          } else {
            return;
          }
        }
        movedRef.current = true;
        setPos(
          clampPos({
            x: e.clientX - dragRef.current.startX,
            y: e.clientY - dragRef.current.startY,
          }),
        );
      }}
      onPointerUp={(e) => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (dragRef.current.pointerId === e.pointerId) {
          dragRef.current.active = false;
          dragRef.current.pointerId = null;
        }
      }}
      onPointerCancel={() => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        dragRef.current.active = false;
        dragRef.current.pointerId = null;
      }}
    >
      <button
        type="button"
        disabled={isBusy && isPanelOpen}
        onClick={() => {
          if (movedRef.current) return;
          setIsPanelOpen((v) => !v);
        }}
        className={`group flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg backdrop-blur-sm transition ${
          isOnline
            ? "border-emerald-400/50 bg-emerald-950/85 text-emerald-100"
            : "border-slate-600 bg-slate-900/90 text-slate-200"
        }`}
        title={isOnline ? "Tap for rider status panel" : "Tap for rider status panel"}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            isOnline ? "bg-emerald-500/25 text-emerald-300" : "bg-slate-700 text-slate-300"
          }`}
        >
          <Bike className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 text-left">
          <span className="block text-[11px] font-semibold leading-tight">{isOnline ? "Rider Live" : "Rider Offline"}</span>
          <span className="block text-[10px] opacity-80 leading-tight">
            {lastLocation ? (
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
      </button>
      {isPanelOpen ? (
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
            disabled={isBusy || !isRider}
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
          <p className="mt-2 text-[10px] text-slate-500">Tip: long-press and drag to move this button.</p>
        </div>
      ) : null}
    </div>
  );
}
