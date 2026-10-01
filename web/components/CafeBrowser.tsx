"use client";

import { useMemo, useState } from "react";
import { applyFilters, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { getOpenStatus } from "@/lib/hours";
import type { Cafe } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { CafeCard } from "./CafeCard";
import { DetailDrawer } from "./DetailDrawer";
import { FilterBar } from "./FilterBar";

export function CafeBrowser({ cafes }: { cafes: Cafe[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = useState<Cafe | null>(null);
  const now = useNow();
  const visible = useMemo(() => applyFilters(cafes, filters, now), [cafes, filters, now]);

  return (
    <div className="flex flex-col gap-5">
      <FilterBar filters={filters} onChange={setFilters} shown={visible.length} total={cafes.length} />
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
          No cafes match these filters.{" "}
          <button type="button" className="underline" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </button>
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((c) => (
            <CafeCard key={c.id} cafe={c} status={now ? getOpenStatus(c.opening_hours, now) : null} onSelect={setSelected} />
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
