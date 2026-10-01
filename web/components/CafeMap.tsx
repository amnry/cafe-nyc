"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/distance";
import type { Cafe } from "@/lib/types";
import { MONO_LABEL } from "./bits";

// Between Washington Square and the West Village; replaced by fitBounds once pins exist.
const DEFAULT_CENTER = { lat: 40.7335, lng: -74.0027 };
// Google's demo Map ID enables Advanced Markers and the dark color scheme. Swap in a
// project Map ID (Google Cloud > Map Management) for production styling control.
const MAP_ID = "DEMO_MAP_ID";

let configured = false;

function pinElement(open: boolean): HTMLElement {
  const el = document.createElement("div");
  el.className =
    "size-3.5 rounded-full border-2 border-[#0c0c0b] shadow-[0_0_0_1px_rgba(0,0,0,.4)] transition-transform hover:scale-125 " +
    (open ? "bg-accent" : "bg-muted");
  return el;
}

function youElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "size-3.5 rounded-full border-2 border-white bg-sky-400 shadow-[0_0_0_6px_rgba(56,189,248,.25)]";
  el.setAttribute("aria-label", "You are here");
  return el;
}

/**
 * Loaded with next/dynamic only when the map is first opened; the Maps JS API itself is
 * requested on mount. One Advanced Marker per cafe with coordinates; clicking opens the
 * shared detail drawer.
 */
export default function CafeMap({ apiKey, cafes, openIds, origin, onSelect }: {
  apiKey: string;
  cafes: Cafe[];
  openIds: Set<string>;
  origin: LatLng | null;
  onSelect: (cafe: Cafe) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<string, google.maps.marker.AdvancedMarkerElement>());
  const you = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const selectRef = useRef(onSelect);
  const fittedKey = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    selectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    let cancelled = false;
    if (!configured) {
      setOptions({ key: apiKey, v: "weekly" });
      configured = true;
    }
    Promise.all([importLibrary("maps"), importLibrary("marker"), importLibrary("core")])
      .then(([{ Map }, , { ColorScheme }]) => {
        if (cancelled || !container.current) return;
        map.current = new Map(container.current, {
          center: DEFAULT_CENTER,
          zoom: 15,
          mapId: MAP_ID,
          colorScheme: ColorScheme.DARK,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Sync pins with the filtered list; refit only when the set of cafes changes.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const { AdvancedMarkerElement } = google.maps.marker;
    const placed = cafes.filter((c) => c.lat !== null && c.lng !== null);
    const keep = new Set(placed.map((c) => c.id));

    for (const [id, marker] of markers.current) {
      if (!keep.has(id)) {
        marker.map = null;
        markers.current.delete(id);
      }
    }
    for (const cafe of placed) {
      const open = openIds.has(cafe.id);
      const existing = markers.current.get(cafe.id);
      if (existing) {
        existing.content = pinElement(open);
        continue;
      }
      const marker = new AdvancedMarkerElement({
        map: m,
        position: { lat: cafe.lat!, lng: cafe.lng! },
        title: cafe.name,
        content: pinElement(open),
        gmpClickable: true,
      });
      marker.addListener("gmp-click", () => selectRef.current(cafe));
      markers.current.set(cafe.id, marker);
    }

    const key = placed.map((c) => c.id).sort().join(",") + (origin ? "|you" : "");
    if (key !== fittedKey.current) {
      fittedKey.current = key;
      const points = placed.map((c) => ({ lat: c.lat!, lng: c.lng! }));
      if (origin) points.push(origin);
      if (points.length === 1) {
        m.setCenter(points[0]);
        m.setZoom(17);
      } else if (points.length > 1) {
        const bounds = new google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend(p));
        m.fitBounds(bounds, 48);
      }
    }
  }, [ready, cafes, openIds, origin]);

  // "You are here" dot, client-side only.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    if (!origin) {
      if (you.current) you.current.map = null;
      you.current = null;
      return;
    }
    if (you.current) you.current.position = origin;
    else
      you.current = new google.maps.marker.AdvancedMarkerElement({
        map: m,
        position: origin,
        title: "You are here",
        content: youElement(),
        zIndex: 1000,
      });
  }, [ready, origin]);

  return (
    <div className="relative h-[70dvh] min-h-[420px] w-full overflow-hidden border border-line bg-surface">
      <div ref={container} className="cafe-map absolute inset-0" />
      {!ready && (
        <p className={`absolute inset-0 grid place-items-center ${MONO_LABEL} text-muted`}>
          {failed ? "Map failed to load. Try again later." : "Loading map…"}
        </p>
      )}
    </div>
  );
}
