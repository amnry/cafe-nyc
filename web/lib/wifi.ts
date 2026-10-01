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

/** Line for a tested cafe: "↓ 85 ↑ 20 Mbps · 4 days". Null if untested. */
export function wifiSummary(c: Wifi): string | null {
  if (!isTested(c)) return null;
  return `↓ ${mbpsText(c.wifi_down_mbps as number)} ↑ ${mbpsText(c.wifi_up_mbps as number)} Mbps · ${daysText(c.wifi_sample_days)}`;
}

/** Tested on fewer than 3 distinct days. Shown in the drawer only, never on the card. */
export const isEarlyData = (c: Wifi): boolean => isTested(c) && c.wifi_sample_days < EARLY_DATA_DAYS;

/** "just now", "5 min ago", "3 hours ago", "2 days ago", "4 months ago". Null for a missing or unparseable time. */
export function timeAgo(iso: string | null, now: number): string | null {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return null;
  const min = Math.max(0, Math.floor((now - t) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 60) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.floor(days / 30);
  return `${months} months ago`;
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
