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

type RiderStatus = "none" | "pending" | "approved" | "blocked";

export function useRiderPresence() {
  const { user, profile } = useAuth();
  const uid = user?.id?.trim() ?? "";
  const role = String(profile?.role ?? user?.user_metadata?.role ?? "buyer").toLowerCase();
  const isRider = role === "rider";
  const [riderStatus, setRiderStatus] = useState<RiderStatus>("none");
  const [presenceRow, setPresenceRow] = useState<PresenceRow | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPresenceTableMissing, setIsPresenceTableMissing] = useState(false);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canUsePresence = riderStatus === "approved";

  const loadPresence = useCallback(async () => {
    if (!uid || !canUsePresence) {
      setPresenceRow(null);
      return;
    }
    const { data, error: e } = await supabase
      .from("rider_presence")
      .select("rider_user_id, is_online, latitude, longitude, last_seen_at")
      .eq("rider_user_id", uid)
      .maybeSingle();
    if (e) {
      setIsPresenceTableMissing(e.code === "42P01" || String(e.message ?? "").toLowerCase().includes("does not exist"));
      setError(e.message || "Could not load presence.");
      return;
    }
    setIsPresenceTableMissing(false);
    setPresenceRow((data as PresenceRow) ?? null);
  }, [uid, canUsePresence]);

  const loadRiderStatus = useCallback(async () => {
    if (!uid) {
      setRiderStatus("none");
      return;
    }
    const { data, error: e } = await supabase.from("riders").select("status").eq("user_id", uid).maybeSingle();
    if (e) {
      setRiderStatus("none");
      return;
    }
    const status = String((data as { status?: string } | null)?.status ?? "").toLowerCase();
    if (status === "pending" || status === "approved" || status === "blocked") {
      setRiderStatus(status);
      return;
    }
    setRiderStatus("none");
  }, [uid]);

  useEffect(() => {
    void loadPresence();
  }, [loadPresence]);

  useEffect(() => {
    void loadRiderStatus();
  }, [loadRiderStatus]);

  const heartbeat = useCallback(async () => {
    if (!uid || !canUsePresence) return;
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
          setIsPresenceTableMissing(e.code === "42P01" || String(e.message ?? "").toLowerCase().includes("does not exist"));
          setError(e.message || "Could not update location.");
          return;
        }
        setIsPresenceTableMissing(false);
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
  }, [uid, canUsePresence]);

  useEffect(() => {
    if (!presenceRow?.is_online || !uid || !canUsePresence) {
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
  }, [presenceRow?.is_online, heartbeat, uid, canUsePresence]);

  useEffect(() => {
    if (!uid || !canUsePresence || !presenceRow?.is_online) return;
    const channel = supabase
      .channel(`rider-presence-self:${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rider_presence", filter: `rider_user_id=eq.${uid}` },
        (payload) => {
          const row = payload.new as PresenceRow | null;
          if (!row) return;
          setPresenceRow(row);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, canUsePresence, presenceRow?.is_online]);

  const toggleAvailability = useCallback(
    async (nextState?: boolean) => {
      if (!uid || !canUsePresence) {
        return;
      }
      const nextOnline = typeof nextState === "boolean" ? nextState : !Boolean(presenceRow?.is_online);
      setIsBusy(true);
      try {
        const { error: e } = await supabase.rpc("rider_set_availability", { p_is_online: nextOnline });
        if (e) throw e;
        setIsPresenceTableMissing(false);
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
        const message = e instanceof Error ? e.message : "Could not update availability.";
        setIsPresenceTableMissing(message.toLowerCase().includes("does not exist"));
        setError(e instanceof Error ? e.message : "Could not update availability.");
      } finally {
        setIsBusy(false);
      }
    },
    [uid, canUsePresence, presenceRow?.is_online, heartbeat],
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
    hasUser: Boolean(uid),
    currentUserId: uid,
    role,
    riderStatus,
    isOnline: Boolean(presenceRow?.is_online),
    toggleAvailability,
    lastLocation,
    onlineSince,
    error,
    isPresenceTableMissing,
    isBusy,
    isRider,
  };
}
