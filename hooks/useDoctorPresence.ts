"use client";

import { useEffect, useRef } from "react";
import type { Session as SupabaseSession } from "@supabase/supabase-js";

const HEARTBEAT_INTERVAL_MS = 60_000;

// Fires a heartbeat every 60s while the doctor dashboard is open, pausing
// when the tab is hidden and resuming on focus, and sends a final beacon on
// unload so presence doesn't linger "online" after the doctor actually left.
export function useDoctorPresence(session: SupabaseSession | null | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session) return;
    const accessToken = session.access_token;

    function sendHeartbeat() {
      fetch("/api/doctor/presence/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({}),
      }).catch(() => {
        // best-effort — a missed heartbeat just means the next one (or the
        // sweep) catches up
      });
    }

    function startInterval() {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    }
    function stopInterval() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        sendHeartbeat();
        startInterval();
      } else {
        stopInterval();
      }
    }

    function handleUnload() {
      navigator.sendBeacon("/api/doctor/presence/offline", JSON.stringify({ access_token: accessToken }));
    }

    sendHeartbeat();
    startInterval();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [session]);
}
