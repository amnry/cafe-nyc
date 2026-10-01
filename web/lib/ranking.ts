import type { Cafe } from "./types";

/** Prior weight: a cafe needs ~50 reviews before its own rating outweighs the average. */
export const BAYES_M = 50;

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

/** Default order: Bayesian score desc, then review count desc, then name. */
export function sortByBayesian(cafes: Cafe[], m: number = BAYES_M): Cafe[] {
  const c = meanRating(cafes);
  return cafes
    .map((cafe) => ({ cafe, score: bayesianScore(cafe, c, m) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.cafe.rating_count ?? 0) - (a.cafe.rating_count ?? 0) ||
        a.cafe.name.localeCompare(b.cafe.name),
    )
    .map((x) => x.cafe);
}
