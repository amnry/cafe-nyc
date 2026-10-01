import { getOpenStatus } from "./hours";
import type { Cafe } from "./types";

/**
 * Random cafe for "Surprise me": prefers cafes that are open now; if none are (or the
 * clock isn't ready) any candidate qualifies. `rng` is injectable for tests.
 */
export function pickSurprise(cafes: Cafe[], now: Date | null, rng: () => number = Math.random): Cafe | null {
  if (cafes.length === 0) return null;
  const open = now ? cafes.filter((c) => getOpenStatus(c.opening_hours, now).state === "open") : [];
  const pool = open.length > 0 ? open : cafes;
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** Count line split so the number can be highlighted: { count: "5", rest: "spots found" }. */
export function spotsLabel(shown: number, total: number): { count: string; rest: string } {
  const noun = (n: number) => (n === 1 ? "spot" : "spots");
  return shown === total
    ? { count: `${total}`, rest: `${noun(total)} found` }
    : { count: `${shown}`, rest: `of ${total} ${noun(total)}` };
}
