"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "./distance";

export type GeoStatus = "off" | "locating" | "on";

/**
 * Browser geolocation for "near me". The position lives only in this component's
 * memory: it is never sent to a server, logged, or written to storage.
 *
 * If the site already has permission, it locates automatically on load, so near-me
 * becomes the default order. Otherwise nothing happens until `locate()` is called.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("off");
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 4000);
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      flash("Location isn't available in this browser. Showing top rated.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("on");
      },
      (err) => {
        setOrigin(null);
        setStatus("off");
        flash(
          err.code === err.PERMISSION_DENIED
            ? "Location is blocked. Showing top rated."
            : "Couldn't get your location. Showing top rated.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, [flash]);

  const clear = useCallback(() => {
    setOrigin(null);
    setStatus("off");
  }, []);

  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => {
        if (!cancelled && p.state === "granted") locate();
      })
      .catch(() => {}); // Permissions API unsupported: wait for the button
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [locate]);

  return { status, origin, notice, locate, clear };
}
