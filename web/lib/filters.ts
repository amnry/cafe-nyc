import { getOpenStatus } from "./hours";
import type { Cafe } from "./types";

export interface Filters {
  restroom: boolean; // true = only cafes with restroom === true (unknown excluded)
  dogs: boolean; // true = only cafes with allows_dogs === true (unknown excluded)
  openNow: boolean;
  prices: number[]; // selected tiers 1-4; empty = no price filter
  neighborhoods: string[]; // empty = all neighborhoods
}

export const DEFAULT_FILTERS: Filters = { restroom: false, dogs: false, openNow: false, prices: [], neighborhoods: [] };

/** Google's level 0 (free) and 1 both display as "$". Null stays null (unknown). */
export function priceTier(level: number | null): number | null {
  if (level === null) return null;
  return Math.min(Math.max(level, 1), 4);
}

export function activeFilterCount(f: Filters): number {
  return Number(f.restroom) + Number(f.dogs) + Number(f.openNow) + f.prices.length + f.neighborhoods.length;
}

/**
 * `now` is null until the client has mounted; the open-now filter is a no-op until then
 * (it cannot be toggled before hydration anyway).
 */
export function applyFilters(cafes: Cafe[], f: Filters, now: Date | null): Cafe[] {
  return cafes.filter((c) => {
    if (f.neighborhoods.length > 0 && !f.neighborhoods.includes(c.neighborhood)) return false;
    if (f.restroom && c.restroom !== true) return false;
    if (f.dogs && c.allows_dogs !== true) return false;
    if (f.prices.length > 0) {
      const tier = priceTier(c.price_level);
      if (tier === null || !f.prices.includes(tier)) return false;
    }
    if (f.openNow && now && getOpenStatus(c.opening_hours, now).state !== "open") return false;
    return true;
  });
}

/** Cafe count per neighborhood, sorted by name. Counts the full list, so they stay stable while filtering. */
export function neighborhoodCounts(cafes: Cafe[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of cafes) counts.set(c.neighborhood, (counts.get(c.neighborhood) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive substring match on the neighborhood name; blank query keeps everything. */
export function matchNeighborhoods<T extends { name: string }>(options: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
}
