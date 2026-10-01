import { describe, expect, it } from "vitest";
import { distanceMeters, sortByDistance, walkLabel } from "./distance";
import type { Cafe } from "./types";

const base: Cafe = {
  id: "1", slug: "a", name: "A", address: null, rating: null, rating_count: null, lat: null, lng: null,
  neighborhood: "West Village", website: null, google_maps_uri: null, price_level: null, business_status: null,
  opening_hours: null, restroom: null, allows_dogs: null, outdoor_seating: null, reservable: null, serves_wine: null,
  ai_summary: null, ai_summary_source: null, google_refreshed_at: null, is_fresh: true,
};

// Washington Square Arch and Caffe Reggio, about 300 m apart.
const arch = { lat: 40.73116, lng: -73.99706 };
const reggio = { lat: 40.7303079, lng: -74.0003706 };

describe("distanceMeters", () => {
  it("is ~0 for the same point and symmetric", () => {
    expect(distanceMeters(arch, arch)).toBeCloseTo(0, 5);
    expect(distanceMeters(arch, reggio)).toBeCloseTo(distanceMeters(reggio, arch), 6);
  });
  it("matches a known short distance within a few meters", () => {
    expect(distanceMeters(arch, reggio)).toBeGreaterThan(280);
    expect(distanceMeters(arch, reggio)).toBeLessThan(310);
  });
});

describe("walkLabel", () => {
  it("rounds at 80 m/min with a 1 minute floor", () => {
    expect(walkLabel(0)).toBe("1 min walk");
    expect(walkLabel(480)).toBe("6 min walk");
    expect(walkLabel(500)).toBe("6 min walk");
  });
  it("switches to km past an hour", () => {
    expect(walkLabel(4720)).toBe("59 min walk");
    expect(walkLabel(4800)).toBe("4.8 km away");
  });
});

describe("sortByDistance", () => {
  it("orders nearest first and puts cafes without coordinates last, stably", () => {
    const far = { ...base, id: "far", lat: 40.7484, lng: -73.9857 };
    const near = { ...base, id: "near", ...reggio };
    const none1 = { ...base, id: "none1" };
    const none2 = { ...base, id: "none2" };
    const out = sortByDistance([none1, far, none2, near], arch);
    expect(out.map((x) => x.cafe.id)).toEqual(["near", "far", "none1", "none2"]);
    expect(out[2].meters).toBeNull();
  });
});
