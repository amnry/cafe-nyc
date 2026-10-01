"use client";

import { activeFilterCount, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { MONO_LABEL } from "./bits";

function Chip({ pressed, onClick, children, label }: {
  pressed: boolean; onClick: () => void; children: React.ReactNode; label?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
      className={
        `border px-2.5 py-1.5 ${MONO_LABEL} transition-colors duration-150 motion-reduce:transition-none ` +
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
        (pressed
          ? "border-accent bg-accent/10 text-accent"
          : "border-line text-muted hover:border-muted hover:text-foreground")
      }
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
    <div className="flex flex-col gap-3 border-y border-line py-3 sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        <Chip pressed={filters.openNow} onClick={() => onChange({ ...filters, openNow: !filters.openNow })}>Open now</Chip>
        <Chip pressed={filters.restroom} onClick={() => onChange({ ...filters, restroom: !filters.restroom })}>Restroom</Chip>
        <Chip pressed={filters.dogs} onClick={() => onChange({ ...filters, dogs: !filters.dogs })}>Dogs OK</Chip>
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        {[1, 2, 3, 4].map((tier) => (
          <Chip key={tier} pressed={filters.prices.includes(tier)} onClick={() => togglePrice(tier)} label={`Price level ${"$".repeat(tier)}`}>
            {"$".repeat(tier)}
          </Chip>
        ))}
        {active > 0 && (
          <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className={`${MONO_LABEL} px-2 text-muted underline underline-offset-4 hover:text-foreground`}>
            Clear
          </button>
        )}
      </div>
      <p className={`${MONO_LABEL} text-muted sm:ml-auto`} aria-live="polite">
        {shown === total ? `${total} cafes` : `${shown} of ${total} cafes`}
      </p>
    </div>
  );
}
