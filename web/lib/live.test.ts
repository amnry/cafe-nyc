import { describe, expect, it } from "vitest";
import { pickSurprise, spotsLabel } from "./live";
import type { Cafe } from "./types";

const base: Cafe = {
  id: "1", slug: "a", name: "A", address: null, rating: null, rating_count: null, lat: null, lng: null,
  neighborhood: "West Village", website: null, google_maps_uri: null, price_level: null, business_status: null,
  opening_hours: null, restroom: null, allows_dogs: null, outdoor_seating: null, reservable: null, serves_wine: null,
  ai_summary: null, ai_summary_source: null, google_refreshed_at: null, is_fresh: true,
};
const tueDay = [{ open: { day: 2, hour: 8, minute: 0 }, close: { day: 2, hour: 17, minute: 0 } }];
const wedDay = [{ open: { day: 3, hour: 8, minute: 0 }, close: { day: 3, hour: 17, minute: 0 } }];
const noonTue = new Date(Date.UTC(2026, 8, 29, 16)); // Tue 12:00 EDT

const cafes: Cafe[] = [
  { ...base, id: "open1", opening_hours: tueDay },
  { ...base, id: "open2", opening_hours: tueDay },
  { ...base, id: "closed", opening_hours: wedDay },
  { ...base, id: "nohours", opening_hours: null },
];

describe("pickSurprise", () => {
  it("prefers open cafes", () => {
    for (const r of [0, 0.4, 0.99]) expect(["open1", "open2"]).toContain(pickSurprise(cafes, noonTue, () => r)?.id);
  });
  it("falls back to any cafe when none are open or the clock is missing", () => {
    expect(pickSurprise(cafes.slice(2), noonTue, () => 0)?.id).toBe("closed");
    expect(pickSurprise(cafes, null, () => 0.99)?.id).toBe("nohours");
  });
  it("returns null for no candidates and never indexes out of range", () => {
    expect(pickSurprise([], noonTue)).toBeNull();
    expect(pickSurprise(cafes, noonTue, () => 1)).not.toBeUndefined();
  });
});

describe("labels", () => {
  it("spotsLabel", () => {
    expect(spotsLabel(5, 5)).toEqual({ count: "5", rest: "spots found" });
    expect(spotsLabel(1, 1)).toEqual({ count: "1", rest: "spot found" });
    expect(spotsLabel(2, 5)).toEqual({ count: "2", rest: "of 5 spots" });
  });
});
