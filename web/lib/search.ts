import Fuse from "fuse.js";
import type { Cafe } from "./types";

/** Typo-tolerant, but strict enough that "West Village" does not also pull in "Greenwich Village". */
const OPTIONS = {
  keys: ["name", "street_address", "neighborhood"],
  threshold: 0.2,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

export function createSearcher(cafes: Cafe[]): Fuse<Cafe> {
  return new Fuse(cafes, OPTIONS);
}

/**
 * Cafes matching `query` over name, street address and neighborhood. Keeps the incoming order
 * (rank, or distance for near-me) rather than match relevance, so a neighborhood query lists its
 * cafes in the usual order. A blank query returns everything.
 */
export function searchCafes(cafes: Cafe[], fuse: Fuse<Cafe>, query: string): Cafe[] {
  const q = query.trim();
  if (!q) return cafes;
  const hits = new Set(fuse.search(q).map((r) => r.item.id));
  return cafes.filter((c) => hits.has(c.id));
}
