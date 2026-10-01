import { describe, expect, it } from "vitest";
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, priceTier } from "./filters";
import type { Cafe } from "./types";

const base: Cafe = {
  id: "1", slug: "a", name: "A", address: null, street_address: null, rating: null, rating_count: null, lat: null, lng: null, neighborhood: "West Village", website: null,
  google_maps_uri: null, price_level: 2, business_status: "OPERATIONAL", opening_hours: null,
  restroom: true, allows_dogs: false, outdoor_seating: null, reservable: null, serves_wine: null,
  ai_summary: null, ai_summary_source: null, google_refreshed_at: null, is_fresh: true,
};
const cafe = (o: Partial<Cafe>): Cafe => ({ ...base, ...o });

// Tue 12:00 EDT, week of Sep 27 2026
const noon = new Date(Date.UTC(2026, 8, 29, 16));
const openTue = [{ open: { day: 2, hour: 8, minute: 0 }, close: { day: 2, hour: 17, minute: 0 } }];

describe("applyFilters", () => {
  it("returns everything with no filters", () => {
    const all = [cafe({ id: "1" }), cafe({ id: "2", restroom: null })];
    expect(applyFilters(all, DEFAULT_FILTERS, noon)).toHaveLength(2);
  });

  it("restroom filter keeps yes only; unknown is NOT treated as yes or no", () => {
    const all = [cafe({ id: "y", restroom: true }), cafe({ id: "n", restroom: false }), cafe({ id: "u", restroom: null })];
    expect(applyFilters(all, { ...DEFAULT_FILTERS, restroom: true }, noon).map((c) => c.id)).toEqual(["y"]);
  });

  it("dogs filter keeps yes only", () => {
    const all = [cafe({ id: "y", allows_dogs: true }), cafe({ id: "n", allows_dogs: false }), cafe({ id: "u", allows_dogs: null })];
    expect(applyFilters(all, { ...DEFAULT_FILTERS, dogs: true }, noon).map((c) => c.id)).toEqual(["y"]);
  });

  it("price filter: multi-select, level 0 counts as $, unknown excluded", () => {
    const all = [
      cafe({ id: "free", price_level: 0 }), cafe({ id: "1", price_level: 1 }),
      cafe({ id: "2", price_level: 2 }), cafe({ id: "4", price_level: 4 }), cafe({ id: "u", price_level: null }),
    ];
    expect(applyFilters(all, { ...DEFAULT_FILTERS, prices: [1] }, noon).map((c) => c.id)).toEqual(["free", "1"]);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, prices: [2, 4] }, noon).map((c) => c.id)).toEqual(["2", "4"]);
  });

  it("open now keeps open only; unknown hours are excluded, not 'closed'", () => {
    const all = [
      cafe({ id: "open", opening_hours: openTue }),
      cafe({ id: "closed", opening_hours: [{ open: { day: 3, hour: 8, minute: 0 }, close: { day: 3, hour: 17, minute: 0 } }] }),
      cafe({ id: "unknown", opening_hours: null }),
    ];
    expect(applyFilters(all, { ...DEFAULT_FILTERS, openNow: true }, noon).map((c) => c.id)).toEqual(["open"]);
  });

  it("open now is a no-op before the client clock exists", () => {
    expect(applyFilters([cafe({ opening_hours: null })], { ...DEFAULT_FILTERS, openNow: true }, null)).toHaveLength(1);
  });

  it("neighborhood filter: multi-select, empty means all", () => {
    const all = [cafe({ id: "w", neighborhood: "West Village" }), cafe({ id: "g", neighborhood: "Greenwich Village" })];
    expect(applyFilters(all, { ...DEFAULT_FILTERS, neighborhoods: ["Greenwich Village"] }, noon).map((c) => c.id)).toEqual(["g"]);
    expect(applyFilters(all, { ...DEFAULT_FILTERS, neighborhoods: ["West Village", "Greenwich Village"] }, noon)).toHaveLength(2);
    expect(applyFilters(all, DEFAULT_FILTERS, noon)).toHaveLength(2);
  });

  it("filters combine with AND", () => {
    const all = [cafe({ id: "a", restroom: true, allows_dogs: true }), cafe({ id: "b", restroom: true, allows_dogs: false })];
    expect(applyFilters(all, { ...DEFAULT_FILTERS, restroom: true, dogs: true }, noon).map((c) => c.id)).toEqual(["a"]);
  });
});

describe("helpers", () => {
  it("priceTier", () => {
    expect([priceTier(null), priceTier(0), priceTier(1), priceTier(4)]).toEqual([null, 1, 1, 4]);
  });
  it("activeFilterCount", () => {
    expect(activeFilterCount({ restroom: true, dogs: false, openNow: true, prices: [1, 2], neighborhoods: ["West Village"] })).toBe(5);
  });
});
