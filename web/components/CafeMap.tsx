"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { LatLng } from "@/lib/distance";
import type { Cafe } from "@/lib/types";
import { MONO_LABEL } from "./bits";

// Between Washington Square and the West Village; replaced by fitBounds once pins exist.
const DEFAULT_CENTER = { lat: 40.7335, lng: -74.0027 };
// Google's demo Map ID enables Advanced Markers and the dark color scheme. Swap in a
// project Map ID (Google Cloud > Map Management) for production styling control.
const MAP_ID = "DEMO_MAP_ID";

let configured = false;

// Hover card: width matches the w-72 wrapper below; the delay lets the cursor cross from the
// pin into the card (to use its buttons) without it closing.
const CARD_W = 288;
const HIDE_DELAY_MS = 150;

function pinElement(open: boolean, name: string): HTMLElement {
  const el = document.createElement("div");
  // Accessible name lives here rather than in the marker title, which would add a native tooltip.
  el.setAttribute("aria-label", name);
  el.className =
    "size-3.5 rounded-full border-2 border-foreground shadow-[0_1px_2px_rgba(26,18,3,.4)] transition-transform hover:scale-125 " +
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
 * shared detail drawer. With a mouse, hovering a pin shows that cafe's card next to it.
 */
export default function CafeMap({ apiKey, cafes, openIds, origin, onSelect, renderCard }: {
  apiKey: string;
  cafes: Cafe[];
  openIds: Set<string>;
  origin: LatLng | null;
  onSelect: (cafe: Cafe) => void;
  renderCard: (cafe: Cafe) => ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef(new Map<string, google.maps.marker.AdvancedMarkerElement>());
  const you = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const selectRef = useRef(onSelect);
  const fittedKey = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ cafe: Cafe; x: number; y: number; w: number; h: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const keepCard = useCallback(() => clearTimeout(hideTimer.current), []);
  const hideCard = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHover(null), HIDE_DELAY_MS);
  }, []);
  // Pin position relative to the map box, read from the pin's own DOM node.
  const showCard = useCallback((cafe: Cafe, pin: HTMLElement) => {
    const box = root.current?.getBoundingClientRect();
    if (!box) return;
    clearTimeout(hideTimer.current);
    const r = pin.getBoundingClientRect();
    setHover({ cafe, x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, w: box.width, h: box.height });
  }, []);

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
          colorScheme: ColorScheme.LIGHT,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
        });
        // The card is placed in pixels, so it would drift once the map moves.
        map.current.addListener("dragstart", () => setHover(null));
        map.current.addListener("zoom_changed", () => setHover(null));
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
    const pin = (cafe: Cafe) => {
      const el = pinElement(openIds.has(cafe.id), cafe.name);
      el.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && showCard(cafe, el));
      el.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && hideCard());
      return el;
    };
    for (const cafe of placed) {
      const existing = markers.current.get(cafe.id);
      if (existing) {
        existing.content = pin(cafe);
        continue;
      }
      const marker = new AdvancedMarkerElement({
        map: m,
        position: { lat: cafe.lat!, lng: cafe.lng! },
        content: pin(cafe),
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
  }, [ready, cafes, openIds, origin, showCard, hideCard]);

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

  // Drop the card if its cafe was filtered out while hovered.
  const shown = hover && cafes.some((c) => c.id === hover.cafe.id) ? hover : null;

  return (
    <div ref={root} className="relative h-[70dvh] min-h-[420px] w-full overflow-hidden border border-line bg-surface">
      <div ref={container} className="cafe-map absolute inset-0" />
      {shown && (
        // Above the pin in the lower half of the map, below it in the upper half; kept inside horizontally.
        <div
          onPointerEnter={keepCard}
          onPointerLeave={hideCard}
          className="map-card absolute z-10 w-72"
          style={{
            left: Math.min(Math.max(shown.x - CARD_W / 2, 8), Math.max(shown.w - CARD_W - 8, 8)),
            ...(shown.y > shown.h / 2 ? { bottom: shown.h - shown.y + 14 } : { top: shown.y + 14 }),
          }}
        >
          {renderCard(shown.cafe)}
        </div>
      )}
      {!ready && (
        <p className={`absolute inset-0 grid place-items-center ${MONO_LABEL} text-muted`}>
          {failed ? "Map failed to load. Try again later." : "Loading map…"}
        </p>
      )}
    </div>
  );
}
