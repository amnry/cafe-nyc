import { describe, expect, it } from "vitest";
import { createSearcher, searchCafes } from "./search";
import type { Cafe } from "./types";

const base: Cafe = {
  id: "x", slug: "x", name: "X", address: null, street_address: null, rating: null, rating_count: null, lat: null, lng: null,
  neighborhood: "West Village", website: null, google_maps_uri: null, price_level: null, business_status: null,
  opening_hours: null, restroom: null, allows_dogs: null, outdoor_seating: null, reservable: null, serves_wine: null,
  ai_summary: null, ai_summary_source: null, google_refreshed_at: null, is_fresh: true,
};
const mk = (id: string, name: string, street: string, neighborhood: string): Cafe => ({ ...base, id, name, street_address: street, neighborhood });

const cafes = [
  mk("1", "787 Coffee", "204 W 10th St", "West Village"),
  mk("2", "Blank Street", "80 University Pl", "Greenwich Village"),
  mk("3", "Café Reggio", "119 Macdougal St", "Greenwich Village"),
  mk("4", "Coppola Cafe", "171 W 4th St", "West Village"),
];
const ids = (q: string) => searchCafes(cafes, createSearcher(cafes), q).map((c) => c.id);

describe("searchCafes", () => {
  it("blank query returns everything, in order", () => {
    expect(ids("")).toEqual(["1", "2", "3", "4"]);
    expect(ids("   ")).toEqual(["1", "2", "3", "4"]);
  });
  it("matches a neighborhood name to every cafe in it, and only it", () => {
    expect(ids("West Village")).toEqual(["1", "4"]);
    expect(ids("greenwich village")).toEqual(["2", "3"]);
  });
  it("matches names, tolerating typos and accents", () => {
    expect(ids("blank stret")).toEqual(["2"]);
    expect(ids("cafe reggio")).toEqual(["3"]);
  });
  it("matches street addresses", () => {
    expect(ids("macdougal")).toEqual(["3"]);
    expect(ids("204 W 10th")).toEqual(["1"]);
  });
  it("returns nothing for a query that matches nothing", () => {
    expect(ids("zzzzqq")).toEqual([]);
  });
  it("keeps the incoming order rather than match relevance", () => {
    const reversed = [...cafes].reverse();
    expect(searchCafes(reversed, createSearcher(reversed), "West Village").map((c) => c.id)).toEqual(["4", "1"]);
  });
});
