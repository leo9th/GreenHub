import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";

type PresenceRow = {
  rider_user_id: string;
  is_online: boolean;
  latitude: number | null;
  longitude: number | null;
  last_seen_at: string | null;
};

export function useRiderPresence() {
  const { user, profile } = useAuth();
  const uid = user?.id?.trim() ?? "";
  const isRider = String(profile?.role ?? "").toLowerCase() === "rider";
  const [presenceRow, setPresenceRow] = useState<PresenceRow | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadPresence = useCallback(async () => {
    if (!uid || !isRider) {
      setPresenceRow(null);
      return;
    }
    const { data, error: e } = await supabase
      .from("rider_presence")
      .select("rider_user_id, is_online, latitude, longitude, last_seen_at")
      .eq("rider_user_id", uid)
      .maybeSingle();
    if (e) {
      setError(e.message || "Could not load presence.");
      return;
    }
    setPresenceRow((data as PresenceRow) ?? null);
  }, [uid, isRider]);

  useEffect(() => {
    void loadPresence();
  }, [loadPresence]);

  const heartbeat = useCallback(async () => {
    if (!uid || !isRider) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const { error: e } = await supabase.rpc("rider_heartbeat_location", {
          p_latitude: latitude,
          p_longitude: longitude,
        });
        if (e) {
          setError(e.message || "Could not update location.");
          return;
        }
        setError(null);
        setPresenceRow((prev) => ({
          rider_user_id: prev?.rider_user_id ?? uid,
          is_online: true,
          latitude,
          longitude,
          last_seen_at: new Date().toISOString(),
        }));
      },
      (geoError) => {
        setError(geoError.message || "Could not access location.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [uid, isRider]);

  useEffect(() => {
    if (!presenceRow?.is_online || !uid || !isRider) {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }
    void heartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      void heartbeat();
    }, 15000);
    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [presenceRow?.is_online, heartbeat, uid, isRider]);

  const toggleAvailability = useCallback(
    async (nextState?: boolean) => {
      if (!uid || !isRider) return;
      const nextOnline = typeof nextState === "boolean" ? nextState : !Boolean(presenceRow?.is_online);
      setIsBusy(true);
      try {
        const { error: e } = await supabase.rpc("rider_set_availability", { p_is_online: nextOnline });
        if (e) throw e;
        setPresenceRow((prev) => ({
          rider_user_id: prev?.rider_user_id ?? uid,
          is_online: nextOnline,
          latitude: nextOnline ? prev?.latitude ?? null : null,
          longitude: nextOnline ? prev?.longitude ?? null : null,
          last_seen_at: nextOnline ? new Date().toISOString() : null,
        }));
        setError(null);
        if (nextOnline) void heartbeat();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not update availability.");
      } finally {
        setIsBusy(false);
      }
    },
    [uid, isRider, presenceRow?.is_online, heartbeat],
  );

  const lastLocation = useMemo(
    () =>
      presenceRow?.latitude != null && presenceRow?.longitude != null
        ? { lat: presenceRow.latitude, lng: presenceRow.longitude }
        : null,
    [presenceRow?.latitude, presenceRow?.longitude],
  );
  const onlineSince = presenceRow?.is_online ? presenceRow?.last_seen_at ?? null : null;

  return {
    isOnline: Boolean(presenceRow?.is_online),
    toggleAvailability,
    lastLocation,
    onlineSince,
    error,
    isBusy,
    isRider,
  };
}
