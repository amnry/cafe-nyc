import { describe, expect, it } from "vitest";
import { CAFE_COLUMNS } from "./cafes";
import { cafeAtLocation, daysText, isEarlyData, isTested, mbpsText, timeAgo, wifiSummary } from "./wifi";
import type { Cafe } from "./types";

const w = (down: number | null, up: number | null, days: number) => ({ wifi_down_mbps: down, wifi_up_mbps: up, wifi_latency_ms: 14, wifi_sample_days: days });

describe("wifiSummary", () => {
  it("shows speeds and days for a tested cafe", () => {
    expect(wifiSummary(w(85.4, 20.2, 4))).toBe("↓ 85 ↑ 20 Mbps · 4 days");
  });
  it("never puts 'early data' on the card line, and says '1 day'", () => {
    expect(wifiSummary(w(85, 20, 2))).toBe("↓ 85 ↑ 20 Mbps · 2 days");
    expect(wifiSummary(w(284, 86, 1))).toBe("↓ 284 ↑ 86 Mbps · 1 day");
    expect(wifiSummary(w(85, 20, 3))).toBe("↓ 85 ↑ 20 Mbps · 3 days");
  });
  it("flags early data (drawer only) under 3 days", () => {
    expect(isEarlyData(w(85, 20, 1))).toBe(true);
    expect(isEarlyData(w(85, 20, 2))).toBe(true);
    expect(isEarlyData(w(85, 20, 3))).toBe(false);
    expect(isEarlyData(w(null, null, 0))).toBe(false);
  });
  it("is null for an untested cafe", () => {
    expect(wifiSummary(w(null, null, 0))).toBeNull();
    expect(isTested(w(null, null, 0))).toBe(false);
    expect(isTested(w(85, 20, 1))).toBe(true);
  });
  it("keeps one decimal below 10 Mbps", () => {
    expect(mbpsText(8.46)).toBe("8.5");
    expect(mbpsText(0.8)).toBe("0.8");
    expect(mbpsText(412.6)).toBe("413");
    expect(daysText(1)).toBe("1 day");
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-10-05T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  it("reads naturally at each scale", () => {
    expect(timeAgo(ago(20_000), now)).toBe("just now");
    expect(timeAgo(ago(5 * 60_000), now)).toBe("5 min ago");
    expect(timeAgo(ago(60 * 60_000), now)).toBe("1 hour ago");
    expect(timeAgo(ago(3 * 3_600_000), now)).toBe("3 hours ago");
    expect(timeAgo(ago(24 * 3_600_000), now)).toBe("1 day ago");
    expect(timeAgo(ago(10 * 86_400_000), now)).toBe("10 days ago");
    expect(timeAgo(ago(90 * 86_400_000), now)).toBe("3 months ago");
  });
  it("treats a time slightly in the future as just now, and junk as null", () => {
    expect(timeAgo(ago(-5000), now)).toBe("just now");
    expect(timeAgo(null, now)).toBeNull();
    expect(timeAgo("nope", now)).toBeNull();
  });
});

describe("cafeAtLocation", () => {
  const at = (id: string, lat: number | null, lng: number | null) => ({ id, name: id, lat, lng }) as Cafe;
  // 0.0005 degrees of latitude is about 56 m; 0.001 is about 111 m.
  const cafes = [at("far", 40.701, -74.0), at("near", 40.7005, -74.0), at("nocoords", null, null)];
  it("returns the cafe within 75 m", () => expect(cafeAtLocation(cafes, { lat: 40.7, lng: -74.0 })?.id).toBe("near"));
  it("returns the nearest when two are in range", () => {
    expect(cafeAtLocation([at("a", 40.7006, -74.0), at("b", 40.7002, -74.0)], { lat: 40.7, lng: -74.0 })?.id).toBe("b");
  });
  it("is null when nothing is within 75 m", () => expect(cafeAtLocation(cafes, { lat: 40.71, lng: -74.0 })).toBeNull());
});

describe("cafes_public columns", () => {
  it("includes the wifi aggregate columns and still excludes laptop and prices", () => {
    for (const c of ["wifi_down_mbps", "wifi_up_mbps", "wifi_latency_ms", "wifi_sample_days", "wifi_last_tested_at"]) {
      expect(CAFE_COLUMNS).toContain(c as never);
    }
    for (const banned of ["laptop", "prices", "latte_price_cents"]) expect(CAFE_COLUMNS).not.toContain(banned as never);
  });
});
