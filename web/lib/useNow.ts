"use client";

import { useMemo, useSyncExternalStore } from "react";

const toMinute = (ms: number) => Math.floor(ms / 60_000);
const minute = () => toMinute(Date.now());

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 15_000); // snapshot only changes when the minute does
  return () => clearInterval(id);
}

/**
 * Current time at minute resolution.
 *
 * `serverTime` (ms) is what the server rendered with. Hydration uses it so the HTML and
 * the first client render match, then the live clock takes over. Pass it where a slightly
 * stale value beats a placeholder (open/closed status: the server HTML is never "—", even
 * if JavaScript is slow or blocked). Omit it where a stale value would be wrong (a clock):
 * that returns null until the client has mounted.
 */
export function useNow(serverTime?: number): Date | null {
  const fallback = serverTime === undefined ? null : toMinute(serverTime);
  const m = useSyncExternalStore(subscribe, minute, () => fallback);
  return useMemo(() => (m === null ? null : new Date(m * 60_000)), [m]);
}
