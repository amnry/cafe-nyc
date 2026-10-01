"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "cafe-nyc:query-changed";

function read(): string {
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange); // back/forward
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/**
 * Search text, stored in the URL (?q=) so a search can be shared. Empty on the server and during
 * hydration. Uses replaceState: typing should not add a history entry per keystroke.
 */
export function useSearchQuery(): [string, (q: string) => void] {
  const q = useSyncExternalStore(subscribe, read, () => "");
  const setQ = useCallback((next: string) => {
    const url = new URL(window.location.href);
    if (next.trim()) url.searchParams.set("q", next);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [q, setQ];
}
