"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { sortByDistance, walkLabel } from "@/lib/distance";
import { useFavorites } from "@/lib/favorites";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { getOpenStatus } from "@/lib/hours";
import { pickSurprise } from "@/lib/live";
import { createSearcher, searchCafes } from "@/lib/search";
import type { Cafe } from "@/lib/types";
import { useGeolocation } from "@/lib/useGeolocation";
import { useNow } from "@/lib/useNow";
import { useSearchQuery } from "@/lib/useSearchQuery";
import { useView } from "@/lib/useView";
import { cafeAtLocation } from "@/lib/wifi";
import { MONO_LABEL } from "./bits";
import { CafeCard } from "./CafeCard";
import { DetailDrawer } from "./DetailDrawer";
import { FilterBar } from "./FilterBar";
import { SearchBar } from "./SearchBar";

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
  const [query, setQuery] = useSearchQuery();
  const geo = useGeolocation();

  const neighborhoods = useMemo(() => [...new Set(cafes.map((c) => c.neighborhood))].sort(), [cafes]);
  const searcher = useMemo(() => createSearcher(cafes), [cafes]);
  // Search and filters combine: a cafe must match both.
  const visible = useMemo(
    () => searchCafes(applyFilters(cafes, filters, now), searcher, query),
    [cafes, filters, now, searcher, query],
  );
  // Server order is by rating; near-me reorders by distance in the browser only.
  const ordered = useMemo(
    () => (geo.origin ? sortByDistance(visible, geo.origin) : visible.map((cafe) => ({ cafe, meters: null }))),
    [visible, geo.origin],
  );
  const openIds = useMemo(
    () => new Set(now ? visible.filter((c) => getOpenStatus(c.opening_hours, now).state === "open").map((c) => c.id) : []),
    [visible, now],
  );

  // Near me on and within 75 m of a cafe: offer the WiFi test. Computed here from the in-memory position.
  const here = useMemo(() => (geo.origin ? cafeAtLocation(cafes, geo.origin) : null), [cafes, geo.origin]);

  const meters = new Map(ordered.map((o) => [o.cafe.id, o.meters]));
  // Same card in the grid and on map-pin hover.
  const card = (cafe: Cafe) => {
    const m = meters.get(cafe.id) ?? null;
    return (
      <CafeCard
        key={cafe.id}
        cafe={cafe}
        status={now ? getOpenStatus(cafe.opening_hours, now) : null}
        walk={m === null ? null : walkLabel(m)}
        favorite={favorites.includes(cafe.id)}
        onToggleFavorite={toggle}
        onSelect={setSelected}
      />
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <SearchBar value={query} onCommit={setQuery} />
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

      {here && (
        <div role="status" className="-mt-2 flex flex-wrap items-center justify-between gap-2 border border-foreground bg-accent px-3 py-2 text-sm text-accent-ink">
          <p>Looks like you&apos;re at {here.name}. Test the WiFi?</p>
          <button
            type="button"
            onClick={() => setSelected(here)}
            className={`${MONO_LABEL} border border-accent-ink px-2 py-1 hover:bg-accent-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-ink`}
          >
            Test the WiFi
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className={`border border-dashed border-line p-10 text-center ${MONO_LABEL} text-muted`}>
          {query.trim() ? (
            <>
              No cafes match{" "}
              <button type="button" className="text-foreground underline decoration-2 underline-offset-4" onClick={() => setQuery("")}>
                Clear search
              </button>
            </>
          ) : (
            <>
              Nothing here. Even the barista is confused.{" "}
              <button type="button" className="text-foreground underline decoration-2 underline-offset-4" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </button>
            </>
          )}
        </p>
      ) : view === "map" ? (
        mapsKey ? (
          <CafeMap
            apiKey={mapsKey}
            cafes={visible}
            openIds={openIds}
            origin={geo.origin}
            onSelect={setSelected}
            renderCard={card}
          />
        ) : (
          <p className={`border border-dashed border-line p-10 text-center ${MONO_LABEL} text-muted`}>
            Map unavailable: NEXT_GOOGLE_MAPS_API_KEY is not set.
          </p>
        )
      ) : (
        <div className="grid grid-cols-1 gap-x-3 gap-y-5 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {ordered.map(({ cafe }) => card(cafe))}
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
