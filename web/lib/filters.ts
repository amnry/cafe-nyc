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
