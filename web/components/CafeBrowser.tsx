"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { sortByDistance, walkLabel } from "@/lib/distance";
import { useFavorites } from "@/lib/favorites";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { getOpenStatus } from "@/lib/hours";
import { pickSurprise } from "@/lib/live";
import type { Cafe } from "@/lib/types";
import { useGeolocation } from "@/lib/useGeolocation";
import { useNow } from "@/lib/useNow";
import { useView } from "@/lib/useView";
import { MONO_LABEL } from "./bits";
import { CafeCard } from "./CafeCard";
import { DetailDrawer } from "./DetailDrawer";
import { FilterBar } from "./FilterBar";

// The map component (and through it the Google Maps JS API) loads on first open only.
const CafeMap = dynamic(() => import("./CafeMap"), {
  ssr: false,
  loading: () => (
    <div className={`grid h-[70dvh] min-h-[420px] place-items-center border border-line bg-surface ${MONO_LABEL} text-muted`}>
      Loading map…
    </div>
  ),
});

export function CafeBrowser({ cafes, renderedAt, mapsKey }: { cafes: Cafe[]; renderedAt: number; mapsKey: string | null }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Cafe | null>(null);
  const now = useNow(renderedAt);
  const { ids: favorites, toggle } = useFavorites();
  const [view, setView] = useView();
  const geo = useGeolocation();

  const neighborhoods = useMemo(() => [...new Set(cafes.map((c) => c.neighborhood))].sort(), [cafes]);
  const visible = useMemo(() => applyFilters(cafes, filters, now), [cafes, filters, now]);
  // Server order is by rating; near-me reorders by distance in the browser only.
  const ordered = useMemo(
    () => (geo.origin ? sortByDistance(visible, geo.origin) : visible.map((cafe) => ({ cafe, meters: null }))),
    [visible, geo.origin],
  );
  const openIds = useMemo(
    () => new Set(now ? visible.filter((c) => getOpenStatus(c.opening_hours, now).state === "open").map((c) => c.id) : []),
    [visible, now],
  );

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        neighborhoods={neighborhoods}
        shown={visible.length}
        total={cafes.length}
        onSurprise={() => setSelected(pickSurprise(visible, now))}
        view={view}
        onViewChange={setView}
        nearMe={geo.status}
        onNearMe={() => (geo.status === "on" ? geo.clear() : geo.locate())}
      />
      {geo.notice && (
        <p role="status" className={`-mt-3 ${MONO_LABEL} text-muted`}>
          {geo.notice}
        </p>
      )}

      {view === "map" ? (
        mapsKey ? (
          <CafeMap apiKey={mapsKey} cafes={visible} openIds={openIds} origin={geo.origin} onSelect={setSelected} />
        ) : (
          <p className={`border border-dashed border-line p-10 text-center ${MONO_LABEL} text-muted`}>
            Map unavailable: NEXT_GOOGLE_MAPS_API_KEY is not set.
          </p>
        )
      ) : visible.length === 0 ? (
        <p className={`border border-dashed border-line p-10 text-center ${MONO_LABEL} text-muted`}>
          Nothing here. Even the barista is confused.{" "}
          <button type="button" className="text-accent underline underline-offset-4" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </button>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {ordered.map(({ cafe, meters }) => (
            <CafeCard
              key={cafe.id}
              cafe={cafe}
              status={now ? getOpenStatus(cafe.opening_hours, now) : null}
              walk={meters === null ? null : walkLabel(meters)}
              favorite={favorites.includes(cafe.id)}
              onToggleFavorite={toggle}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}
      {selected && (
        <DetailDrawer
          key={selected.id}
          cafe={selected}
          status={now ? getOpenStatus(selected.opening_hours, now) : null}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
