import { distanceMeters, type LatLng } from "./distance";
import type { Cafe } from "./types";

/** Cafes with fewer distinct test days than this read "early data". */
export const EARLY_DATA_DAYS = 3;
/** Near-me banner: the visitor counts as "at" a cafe within this distance. */
export const AT_CAFE_M = 75;

type Wifi = Pick<Cafe, "wifi_down_mbps" | "wifi_up_mbps" | "wifi_latency_ms" | "wifi_sample_days">;

/** 85.4 -> "85", 8.46 -> "8.5": whole numbers once past 10 Mbps. */
export function mbpsText(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10);
}

export const isTested = (c: Wifi): boolean => c.wifi_sample_days > 0 && c.wifi_down_mbps !== null && c.wifi_up_mbps !== null;

export const daysText = (days: number): string => `${days} ${days === 1 ? "day" : "days"}`;

/** Card line for a tested cafe: "↓ 85 ↑ 20 Mbps · 4 days", plus "early data" under 3 days. Null if untested. */
export function wifiSummary(c: Wifi): string | null {
  if (!isTested(c)) return null;
  const base = `↓ ${mbpsText(c.wifi_down_mbps as number)} ↑ ${mbpsText(c.wifi_up_mbps as number)} Mbps · ${daysText(c.wifi_sample_days)}`;
  return c.wifi_sample_days < EARLY_DATA_DAYS ? `${base} · early data` : base;
}

/** The nearest cafe within 75 m of the visitor, for the "Looks like you're at X" banner. */
export function cafeAtLocation(cafes: Cafe[], origin: LatLng, radiusM: number = AT_CAFE_M): Cafe | null {
  let best: { cafe: Cafe; m: number } | null = null;
  for (const cafe of cafes) {
    if (cafe.lat === null || cafe.lng === null) continue;
    const m = distanceMeters(origin, { lat: cafe.lat, lng: cafe.lng });
    if (m <= radiusM && (!best || m < best.m)) best = { cafe, m };
  }
  return best?.cafe ?? null;
}
