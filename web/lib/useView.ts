"use client";

import { useCallback, useSyncExternalStore } from "react";

export type View = "grid" | "map";
const EVENT = "cafe-nyc:view-changed";

function read(): View {
  return new URLSearchParams(window.location.search).get("view") === "map" ? "map" : "grid";
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
 * Grid/map view, stored in the URL (?view=map) so it can be shared and the back button
 * returns to the grid. Grid on the server and during hydration.
 */
export function useView(): [View, (view: View) => void] {
  const view = useSyncExternalStore(subscribe, read, () => "grid" as View);
  const setView = useCallback((next: View) => {
    const url = new URL(window.location.href);
    if (next === "map") url.searchParams.set("view", "map");
    else url.searchParams.delete("view");
    window.history.pushState(null, "", url);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [view, setView];
}
