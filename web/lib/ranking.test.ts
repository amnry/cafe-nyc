import { describe, expect, it } from "vitest";
import { bayesianScore, meanRating, sortByBayesian } from "./ranking";
import type { Cafe } from "./types";

const base: Cafe = {
  id: "x", slug: "x", name: "X", address: null, street_address: null, rating: null, rating_count: null, lat: null, lng: null,
  neighborhood: "West Village", website: null, google_maps_uri: null, price_level: null, business_status: null,
  opening_hours: null, restroom: null, allows_dogs: null, outdoor_seating: null, reservable: null, serves_wine: null,
  ai_summary: null, ai_summary_source: null, google_refreshed_at: null, is_fresh: true,
};
const cafe = (id: string, rating: number | null, count: number | null): Cafe => ({ ...base, id, name: id, rating, rating_count: count });

describe("meanRating", () => {
  it("averages rated cafes only", () => {
    expect(meanRating([cafe("a", 4, 10), cafe("b", 5, 10), cafe("c", null, null)])).toBe(4.5);
    expect(meanRating([])).toBe(0);
  });
});

describe("bayesianScore", () => {
  it("matches the formula", () => {
    // v=50, m=50: halfway between R=5 and C=4
    expect(bayesianScore(cafe("a", 5, 50), 4)).toBeCloseTo(4.5, 10);
    expect(bayesianScore(cafe("a", 4.9, 4894), 4.3)).toBeCloseTo((4894 / 4944) * 4.9 + (50 / 4944) * 4.3, 10);
  });
  it("cafes with no rating or no reviews score exactly C", () => {
    expect(bayesianScore(cafe("a", null, null), 4.3)).toBe(4.3);
    expect(bayesianScore(cafe("a", 5, 0), 4.3)).toBe(4.3);
  });
});

describe("sortByBayesian", () => {
  it("ranks a well-reviewed 4.9 above a 5.0 with a handful of reviews", () => {
    const list = [cafe("tiny5", 5, 2), cafe("big49", 4.9, 4894), cafe("mid42", 4.2, 2133), cafe("unrated", null, null)];
    expect(sortByBayesian(list).map((c) => c.id)).toEqual(["big49", "tiny5", "unrated", "mid42"]);
  });
  it("breaks score ties by review count, then name", () => {
    const list = [cafe("b", null, null), cafe("a", null, null)];
    expect(sortByBayesian(list).map((c) => c.id)).toEqual(["a", "b"]);
  });
});
