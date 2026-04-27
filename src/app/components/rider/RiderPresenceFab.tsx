import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { Bike, MapPin, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { useRiderPresence } from "../../hooks/useRiderPresence";
import { normalizeRiderFabMode, resolveInitialRiderFabMode, type RiderFabMode, riderFabModeStorageKey } from "../../utils/riderFabMode";

type Pos = { x: number; y: number };
type SavedFabPos = { x: number; y: number };
const FAB_SIZE_PX = 72;
const FAB_MARGIN_PX = 16;
const FAB_MIN_Y_PX = 80;
const DRAG_SUPPRESS_CLICK_MS = 120;

function getDefaultPos(): Pos {
  if (typeof window === "undefined") return { x: FAB_MARGIN_PX, y: 220 };
  return {
    x: Math.max(FAB_MARGIN_PX, window.innerWidth - FAB_SIZE_PX - FAB_MARGIN_PX),
    y: Math.max(FAB_MIN_Y_PX, window.innerHeight - FAB_SIZE_PX - FAB_MARGIN_PX),
  };
}

function clampPos(pos: Pos): Pos {
  if (typeof window === "undefined") return pos;
  const w = window.innerWidth;
  const h = window.innerHeight;
  return {
    x: Math.min(Math.max(FAB_MARGIN_PX, pos.x), Math.max(FAB_MARGIN_PX, w - FAB_SIZE_PX - FAB_MARGIN_PX)),
    y: Math.min(Math.max(FAB_MIN_Y_PX, pos.y), Math.max(FAB_MIN_Y_PX, h - FAB_SIZE_PX)),
  };
}

export default function RiderPresenceFab() {
  const navigate = useNavigate();
  const { hasUser, currentUserId, role, riderStatus, isRider, isOnline, toggleAvailability, lastLocation, onlineSince, error, isBusy } =
    useRiderPresence();
  const isRiderCapable = isRider || riderStatus !== "none";
  const canUseRiderPresence = isRider && riderStatus === "approved";
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<RiderFabMode>("booking");
  const [pos, setPos] = useState<Pos>(() => getDefaultPos());
  const suppressClickRef = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const fabStorageKey = useMemo(() => (currentUserId ? `fab_position_${currentUserId}` : null), [currentUserId]);

  const applyMode = (nextMode: RiderFabMode) => {
    const normalized: RiderFabMode = nextMode === "rider" && !isRiderCapable ? "booking" : nextMode;
    setMode(normalized);
    setIsPanelOpen(false);
    if (typeof window === "undefined" || !currentUserId) return;
    window.localStorage.setItem(riderFabModeStorageKey(currentUserId), normalized);
  };

  const persistPos = (next: Pos) => {
    if (typeof window === "undefined") return;
    if (!fabStorageKey) return;
    const payload: SavedFabPos = { x: next.x, y: next.y };
    window.localStorage.setItem(fabStorageKey, JSON.stringify(payload));
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => {
      const next = clampPos(pos);
      setPos(next);
      persistPos(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos, fabStorageKey]);

  useEffect(() => {
    if (!error || error === lastErrorRef.current) return;
    lastErrorRef.current = error;
    toast.error(error);
  }, [error]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasUser || !currentUserId) {
      setMode("booking");
      return;
    }
    const saved = normalizeRiderFabMode(window.localStorage.getItem(riderFabModeStorageKey(currentUserId)));
    const resolved = resolveInitialRiderFabMode({ isRiderCapable, savedMode: saved });
    setMode(resolved);
  }, [hasUser, currentUserId, isRiderCapable]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!fabStorageKey) {
      setPos(getDefaultPos());
      return;
    }
    try {
      const raw = window.localStorage.getItem(fabStorageKey);
      if (!raw) {
        setPos(getDefaultPos());
        return;
      }
      const parsed = JSON.parse(raw) as Partial<SavedFabPos>;
      if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
        setPos(getDefaultPos());
        return;
      }
      setPos(clampPos({ x: parsed.x, y: parsed.y }));
    } catch {
      setPos(getDefaultPos());
    }
  }, [fabStorageKey]);

  const dragBounds = useMemo(() => {
    if (typeof window === "undefined") return { left: FAB_MARGIN_PX, top: FAB_MIN_Y_PX, right: FAB_MARGIN_PX, bottom: FAB_MIN_Y_PX };
    return {
      left: FAB_MARGIN_PX,
      top: FAB_MIN_Y_PX,
      right: Math.max(FAB_MARGIN_PX, window.innerWidth - FAB_SIZE_PX - FAB_MARGIN_PX),
      bottom: Math.max(FAB_MIN_Y_PX, window.innerHeight - FAB_SIZE_PX),
    };
  }, [pos.x, pos.y]);

  if (!hasUser) return null;

  return (
    <motion.div
      className="fixed left-0 top-0 z-[80]"
      style={{ x: pos.x, y: pos.y, touchAction: "manipulation" }}
      drag
      dragConstraints={dragBounds}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => {
        setIsDragging(true);
        suppressClickRef.current = true;
      }}
      onDragEnd={(_, info) => {
        const next = clampPos({
          x: info.point.x - FAB_SIZE_PX / 2,
          y: info.point.y - FAB_SIZE_PX / 2,
        });
        setPos(next);
        persistPos(next);
        window.setTimeout(() => {
          suppressClickRef.current = false;
          setIsDragging(false);
        }, DRAG_SUPPRESS_CLICK_MS);
      }}
    >
      <motion.button
        type="button"
        disabled={isBusy && isPanelOpen}
        onClick={() => {
          if (isDragging || suppressClickRef.current) return;
          if (mode === "booking") {
            navigate("/book");
            return;
          }
          setIsPanelOpen((v) => !v);
        }}
        className={`group flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg backdrop-blur-sm transition ${
          mode === "rider"
            ? canUseRiderPresence
              ? isOnline
                ? "border-emerald-400/50 bg-emerald-950/85 text-emerald-100 drop-shadow-[0_0_12px_rgba(16,185,129,0.45)]"
                : "border-slate-600 bg-slate-900/90 text-slate-200"
              : "border-amber-400/40 bg-amber-950/85 text-amber-100"
            : "border-indigo-400/40 bg-indigo-950/85 text-indigo-100"
        }`}
        title={mode === "booking" ? "GreenGo booking mode" : canUseRiderPresence ? (isOnline ? "On Duty" : "Offline") : "Rider mode"}
        animate={mode === "rider" && canUseRiderPresence && isOnline ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={mode === "rider" && canUseRiderPresence && isOnline ? { duration: 3, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
        whileTap={{ scale: 0.95 }}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            mode === "rider"
              ? canUseRiderPresence
                ? isOnline
                  ? "bg-emerald-500/25 text-emerald-300"
                  : "bg-slate-700 text-slate-300"
                : "bg-amber-500/25 text-amber-300"
              : "bg-indigo-500/25 text-indigo-300"
          }`}
        >
          {mode === "booking" ? <ShoppingBag className="h-4 w-4" aria-hidden /> : <Bike className="h-4 w-4" aria-hidden />}
        </span>
        <span className="min-w-0 text-left">
          <span className="block text-[11px] font-semibold leading-tight">
            {mode === "booking" ? "GreenGo Booking" : canUseRiderPresence ? (isOnline ? "On Duty" : "Offline") : "Rider Mode"}
          </span>
          <span className="block text-[10px] opacity-80 leading-tight">
            {mode === "booking" ? (
              "Tap to open GreenGo"
            ) : !canUseRiderPresence ? (
              riderStatus === "pending"
                ? "Approval pending"
                : riderStatus === "blocked"
                  ? "Access blocked"
                  : "Rider approval required"
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
      <button
        type="button"
        onClick={() => applyMode(mode === "booking" ? "rider" : "booking")}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-2 text-[11px] font-semibold text-slate-100 shadow-md hover:bg-slate-800"
      >
        Switch to {mode === "booking" ? "Rider" : "GreenGo"} mode
      </button>
      {isPanelOpen && mode === "rider" ? (
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
            Status:{" "}
            <span className={canUseRiderPresence && isOnline ? "text-emerald-300" : "text-slate-400"}>
              {canUseRiderPresence ? (isOnline ? "Online" : "Offline") : "Unavailable"}
            </span>
          </p>
          {canUseRiderPresence ? <p className="mt-1 text-[10px] text-emerald-300/80">Live status for GreenGo rider dispatch.</p> : null}
          {!canUseRiderPresence ? (
            <p className="mt-1 text-[10px] text-amber-300">
              {isRider
                ? riderStatus === "pending"
                  ? "Your rider account is pending approval."
                  : riderStatus === "blocked"
                    ? "Your rider account is blocked."
                    : "Rider approval required to go online."
                : "Switch account role to rider to use GreenGo rider mode."}
            </p>
          ) : null}
          <p className="mt-1 text-slate-400">
            Last update: {onlineSince ? new Date(onlineSince).toLocaleTimeString() : "—"}
          </p>
          <p className="mt-1 text-slate-400">
            Coordinates: {lastLocation ? `${lastLocation.lat.toFixed(5)}, ${lastLocation.lng.toFixed(5)}` : "No fix yet"}
          </p>
          <button
            type="button"
            disabled={isBusy || !canUseRiderPresence}
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applyMode("booking")}
              className="rounded-lg border border-indigo-500/50 bg-indigo-950/70 px-2 py-1.5 text-[11px] font-semibold text-indigo-100"
            >
              GreenGo mode
            </button>
            <button
              type="button"
              onClick={() => applyMode("rider")}
              className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-[11px] font-semibold text-slate-100"
            >
              Rider mode
            </button>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Tip: drag to move this button.</p>
        </div>
      ) : null}
    </motion.div>
  );
}
