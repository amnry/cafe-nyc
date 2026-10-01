"use client";

import { useMemo, useState } from "react";
import { useFavorites } from "@/lib/favorites";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { getOpenStatus } from "@/lib/hours";
import { pickSurprise } from "@/lib/live";
import type { Cafe } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { MONO_LABEL } from "./bits";
import { CafeCard } from "./CafeCard";
import { DetailDrawer } from "./DetailDrawer";
import { FilterBar } from "./FilterBar";

export function CafeBrowser({ cafes }: { cafes: Cafe[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Cafe | null>(null);
  const now = useNow();
  const { ids: favorites, toggle } = useFavorites();
  const visible = useMemo(() => applyFilters(cafes, filters, now), [cafes, filters, now]);
  const neighborhoods = useMemo(() => [...new Set(cafes.map((c) => c.neighborhood))].sort(), [cafes]);

  return (
    <div className="flex flex-col gap-5">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        neighborhoods={neighborhoods}
        shown={visible.length}
        total={cafes.length}
        onSurprise={() => setSelected(pickSurprise(visible, now))}
      />
      {visible.length === 0 ? (
        <p className={`border border-dashed border-line p-10 text-center ${MONO_LABEL} text-muted`}>
          Nothing here. Even the barista is confused.{" "}
          <button type="button" className="text-accent underline underline-offset-4" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </button>
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((c) => (
            <CafeCard
              key={c.id}
              cafe={c}
              status={now ? getOpenStatus(c.opening_hours, now) : null}
              favorite={favorites.includes(c.id)}
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
