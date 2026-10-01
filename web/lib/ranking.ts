import { visibleSummary } from "./drawer";
import type { Cafe } from "./types";

/** Prior weight: a cafe needs ~50 reviews before its own rating outweighs the average. */
export const BAYES_M = 50;

/** Weight of the data-completeness bonus (0-1 scale) added to the Bayesian rating. */
export const COMPLETENESS_WEIGHT = 0.3;

/** Mean rating across rated cafes (C). */
export function meanRating(cafes: Cafe[]): number {
  const rated = cafes.filter((c) => c.rating !== null);
  return rated.length ? rated.reduce((s, c) => s + (c.rating as number), 0) / rated.length : 0;
}

/**
 * Bayesian average: (v/(v+m))·R + (m/(v+m))·C, with v = review count. A cafe with no
 * rating or no reviews scores exactly C.
 */
export function bayesianScore(cafe: Cafe, c: number, m: number = BAYES_M): number {
  const v = cafe.rating === null ? 0 : (cafe.rating_count ?? 0);
  if (v === 0) return c;
  return (v / (v + m)) * (cafe.rating as number) + (m / (v + m)) * c;
}

/**
 * Share of the four attributes we can show on a card/drawer: restroom, dogs, outdoor seating
 * (each counts when not null) plus a Google summary (counts when one is shown). 0 to 1.
 */
export function completeness(cafe: Cafe): number {
  const known = [cafe.restroom, cafe.allows_dogs, cafe.outdoor_seating].filter((v) => v !== null).length;
  return (known + (visibleSummary(cafe) !== null ? 1 : 0)) / 4;
}

/** Ranking score: Bayesian rating + COMPLETENESS_WEIGHT * completeness. */
export function rankScore(cafe: Cafe, c: number, m: number = BAYES_M): number {
  return bayesianScore(cafe, c, m) + COMPLETENESS_WEIGHT * completeness(cafe);
}

/** Default order: rank score desc, then review count desc, then name. */
export function sortByRank(cafes: Cafe[], m: number = BAYES_M): Cafe[] {
  const c = meanRating(cafes);
  return cafes
    .map((cafe) => ({ cafe, score: rankScore(cafe, c, m) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.cafe.rating_count ?? 0) - (a.cafe.rating_count ?? 0) ||
        a.cafe.name.localeCompare(b.cafe.name),
    )
    .map((x) => x.cafe);
}
