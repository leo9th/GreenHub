import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Bike, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { useRiderPresence } from "../../hooks/useRiderPresence";

type Pos = { x: number; y: number };
const STORAGE_KEY = "gh_rider_presence_fab_pos";

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
  const navigate = useNavigate();
  const { hasUser, role, isRider, isOnline, toggleAvailability, lastLocation, onlineSince, error, isBusy } = useRiderPresence();
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
  const movedRef = useRef(false);

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
      style={{ left: `${pos.x}px`, top: `${pos.y}px`, touchAction: "manipulation" }}
    >
      <motion.button
        type="button"
        disabled={isBusy && isPanelOpen}
        onClick={() => {
          if (movedRef.current) return;
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
