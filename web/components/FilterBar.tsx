"use client";

import { activeFilterCount, type Filters, DEFAULT_FILTERS } from "@/lib/filters";

function Chip({ pressed, onClick, children, label }: {
  pressed: boolean; onClick: () => void; children: React.ReactNode; label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        pressed
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}

export function FilterBar({ filters, onChange, shown, total }: {
  filters: Filters; onChange: (f: Filters) => void; shown: number; total: number;
}) {
  const togglePrice = (tier: number) =>
    onChange({
      ...filters,
      prices: filters.prices.includes(tier) ? filters.prices.filter((t) => t !== tier) : [...filters.prices, tier].sort(),
    });
  const active = activeFilterCount(filters);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      <Chip pressed={filters.openNow} onClick={() => onChange({ ...filters, openNow: !filters.openNow })}>Open now</Chip>
      <Chip pressed={filters.restroom} onClick={() => onChange({ ...filters, restroom: !filters.restroom })}>Restroom</Chip>
      <Chip pressed={filters.dogs} onClick={() => onChange({ ...filters, dogs: !filters.dogs })}>Dogs OK</Chip>
      <span className="mx-1 h-5 w-px bg-zinc-300 dark:bg-zinc-700" aria-hidden />
      {[1, 2, 3, 4].map((tier) => (
        <Chip key={tier} pressed={filters.prices.includes(tier)} onClick={() => togglePrice(tier)} label={`Price level ${"$".repeat(tier)}`}>
          {"$".repeat(tier)}
        </Chip>
      ))}
      {active > 0 && (
        <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="px-2 text-sm underline underline-offset-2">
          Clear
        </button>
      )}
      <p className="ml-auto text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {shown} of {total} cafes
      </p>
    </div>
  );
}
