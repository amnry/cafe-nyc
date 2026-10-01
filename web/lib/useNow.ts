"use client";

import { useMemo, useSyncExternalStore } from "react";

const minute = () => Math.floor(Date.now() / 60_000);

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 15_000); // snapshot only changes when the minute does
  return () => clearInterval(id);
}

/**
 * Current time (minute resolution), or null on the server and during hydration so the
 * first client render matches the server HTML. Updates when the minute rolls over.
 */
export function useNow(): Date | null {
  const m = useSyncExternalStore(subscribe, minute, () => null);
  return useMemo(() => (m === null ? null : new Date(m * 60_000)), [m]);
}
