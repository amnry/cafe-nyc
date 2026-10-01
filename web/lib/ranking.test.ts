import { describe, expect, it } from "vitest";
import { bayesianScore, COMPLETENESS_WEIGHT, completeness, meanRating, rankScore, sortByRank } from "./ranking";
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

describe("sortByRank", () => {
  it("ranks a well-reviewed 4.9 above a 5.0 with a handful of reviews", () => {
    const list = [cafe("tiny5", 5, 2), cafe("big49", 4.9, 4894), cafe("mid42", 4.2, 2133), cafe("unrated", null, null)];
    expect(sortByRank(list).map((c) => c.id)).toEqual(["big49", "tiny5", "unrated", "mid42"]);
  });
  it("breaks score ties by review count, then name", () => {
    const list = [cafe("b", null, null), cafe("a", null, null)];
    expect(sortByRank(list).map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("completeness", () => {
  const full: Partial<Cafe> = { restroom: true, allows_dogs: false, outdoor_seating: true, ai_summary: "g", ai_summary_source: "generative" };
  it("counts non-null attributes (false counts) and a shown Google summary, out of 4", () => {
    expect(completeness(cafe("a", 4, 10))).toBe(0);
    expect(completeness({ ...cafe("a", 4, 10), ...full })).toBe(1);
    expect(completeness({ ...cafe("a", 4, 10), restroom: false, allows_dogs: null, outdoor_seating: true })).toBe(0.5);
  });
  it("does not count a hidden Haiku summary or a missing one", () => {
    expect(completeness({ ...cafe("a", 4, 10), ai_summary: "h", ai_summary_source: "haiku" })).toBe(0);
    expect(completeness({ ...cafe("a", 4, 10), ai_summary: null, ai_summary_source: "generative" })).toBe(0);
    expect(completeness({ ...cafe("a", 4, 10), ai_summary: "e", ai_summary_source: "editorial" })).toBe(0.25);
  });
});

describe("rankScore", () => {
  it("is Bayesian + weight * completeness", () => {
    const c = { ...cafe("a", 5, 50), restroom: true, allows_dogs: true };
    expect(rankScore(c, 4)).toBeCloseTo(4.5 + COMPLETENESS_WEIGHT * 0.5, 10);
  });
});

describe("sortByRank completeness bonus", () => {
  it("a 3.5 chain with full data still ranks below a 4.7 cafe with no data", () => {
    const chain = {
      ...cafe("chain", 3.5, 1200), restroom: true, allows_dogs: true, outdoor_seating: true,
      ai_summary: "g", ai_summary_source: "generative" as const,
    };
    const bare = cafe("bare", 4.7, 300);
    expect(sortByRank([chain, bare]).map((c) => c.id)).toEqual(["bare", "chain"]);
  });
  it("breaks a near-tie in favor of the cafe with more data", () => {
    const a = cafe("a", 4.5, 400);
    const b = { ...cafe("b", 4.5, 400), restroom: true, allows_dogs: false };
    expect(sortByRank([a, b]).map((c) => c.id)).toEqual(["b", "a"]);
  });
});
