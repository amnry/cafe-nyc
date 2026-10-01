import { describe, expect, it } from "vitest";
import { distanceMeters } from "@/lib/distance";
import { checkGeofence } from "./geofence";

describe("checkGeofence", () => {
  it("passes within 75 m", () => expect(checkGeofence(75, 0)).toBe("ok"));
  it("fails just past 75 m with no accuracy credit", () => expect(checkGeofence(75.1, 0)).toBe("too_far"));
  it("credits accuracy against the distance", () => {
    expect(checkGeofence(125, 50)).toBe("ok"); // 125 - 50 = 75
    expect(checkGeofence(126, 50)).toBe("too_far");
  });
  it("caps the accuracy credit at 100 m", () => {
    expect(checkGeofence(175, 200)).toBe("ok"); // 175 - 100 = 75
    expect(checkGeofence(176, 200)).toBe("too_far");
  });
  it("rejects accuracy worse than 300 m even when close", () => {
    expect(checkGeofence(0, 300)).toBe("ok");
    expect(checkGeofence(0, 300.1)).toBe("low_accuracy");
  });
  it("matches real distances: ~500 m away is too far", () => {
    const cafe = { lat: 40.7, lng: -74.0 };
    expect(checkGeofence(distanceMeters({ lat: 40.7045, lng: -74.0 }, cafe), 20)).toBe("too_far");
    expect(checkGeofence(distanceMeters({ lat: 40.7003, lng: -74.0 }, cafe), 20)).toBe("ok");
  });
});
