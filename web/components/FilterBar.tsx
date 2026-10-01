"use client";

import { activeFilterCount, DEFAULT_FILTERS, type Filters } from "@/lib/filters";
import { spotsLabel } from "@/lib/live";
import type { GeoStatus } from "@/lib/useGeolocation";
import type { View } from "@/lib/useView";
import { AttrGlyph } from "./AttrIcon";
import { MONO_LABEL } from "./bits";

/** A tray of segments. Groups related filters; slightly rounded, not pills. */
function Segment({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-line bg-background p-0.5">
      {children}
    </div>
  );
}

/**
 * Selected = raised surface, bright text, thin accent underline (absolutely positioned, so
 * toggling never shifts layout). Unselected = flat muted text.
 */
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
        "relative inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] leading-5 font-medium " +
        "transition-colors duration-150 motion-reduce:transition-none " +
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent " +
        (pressed
          ? "bg-surface-2 text-foreground shadow-[inset_0_0_0_1px_var(--line)] " +
            "after:absolute after:inset-x-3 after:bottom-0.5 after:h-px after:bg-accent after:content-['']"
          : "text-muted hover:bg-surface hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

export function FilterBar({ filters, onChange, neighborhoods, shown, total, onSurprise, view, onViewChange, nearMe, onNearMe }: {
  filters: Filters; onChange: (f: Filters) => void; neighborhoods: string[]; shown: number; total: number;
  onSurprise: () => void;
  view: View; onViewChange: (v: View) => void;
  nearMe: GeoStatus; onNearMe: () => void;
}) {
  const toggleNeighborhood = (name: string) =>
    onChange({
      ...filters,
      neighborhoods: filters.neighborhoods.includes(name)
        ? filters.neighborhoods.filter((n) => n !== name)
        : [...filters.neighborhoods, name],
    });
  const togglePrice = (tier: number) =>
    onChange({
      ...filters,
      prices: filters.prices.includes(tier) ? filters.prices.filter((t) => t !== tier) : [...filters.prices, tier].sort(),
    });
  const active = activeFilterCount(filters);
  return (
    <div className="flex flex-col gap-3 border-y border-line py-3 sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <Segment label="Neighborhood">
          {neighborhoods.map((name) => (
            <Chip key={name} pressed={filters.neighborhoods.includes(name)} onClick={() => toggleNeighborhood(name)}>
              {name}
            </Chip>
          ))}
        </Segment>
        <Segment label="Amenities">
          <Chip pressed={filters.openNow} onClick={() => onChange({ ...filters, openNow: !filters.openNow })}>Open now</Chip>
          <Chip pressed={filters.restroom} onClick={() => onChange({ ...filters, restroom: !filters.restroom })}>
            <AttrGlyph kind="restroom" />
            Restroom
          </Chip>
          <Chip pressed={filters.dogs} onClick={() => onChange({ ...filters, dogs: !filters.dogs })}>
            <AttrGlyph kind="dogs" />
            Dogs OK
          </Chip>
        </Segment>
        <Segment label="Price">
          {[1, 2, 3, 4].map((tier) => (
            <Chip key={tier} pressed={filters.prices.includes(tier)} onClick={() => togglePrice(tier)} label={`Price level ${"$".repeat(tier)}`}>
              {"$".repeat(tier)}
            </Chip>
          ))}
        </Segment>
        {active > 0 && (
          <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="px-2 text-[13px] text-muted underline underline-offset-4 hover:text-foreground">
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:gap-3">
        <Segment label="Sort">
          <Chip pressed={nearMe === "on"} onClick={onNearMe} label={nearMe === "on" ? "Near me (on), tap to sort by rating" : "Sort by distance from me"}>
            {nearMe === "locating" ? "Locating…" : "Near me"}
          </Chip>
        </Segment>
        <Segment label="View">
          <Chip pressed={view === "grid"} onClick={() => onViewChange("grid")}>Grid</Chip>
          <Chip pressed={view === "map"} onClick={() => onViewChange("map")}>Map</Chip>
        </Segment>
        <button
          type="button"
          onClick={onSurprise}
          disabled={shown === 0}
          className={
            "rounded-lg border border-line px-3 py-1.5 text-[13px] leading-5 font-medium text-foreground " +
            "transition-colors duration-150 hover:border-accent motion-reduce:transition-none " +
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
            "disabled:pointer-events-none disabled:opacity-40"
          }
        >
          Surprise me
        </button>
        <p className={`${MONO_LABEL} text-muted`} aria-live="polite">
          <span className="text-accent">{spotsLabel(shown, total).count}</span> {spotsLabel(shown, total).rest}
        </p>
      </div>
    </div>
  );
}
