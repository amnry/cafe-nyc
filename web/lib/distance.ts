import type { Cafe } from "./types";

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
export const WALK_M_PER_MIN = 80;

/** Great-circle distance in meters (haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** "6 min walk" at ~80 m/min; beyond an hour's walk, a distance reads better. */
export function walkLabel(meters: number): string {
  const minutes = Math.max(1, Math.round(meters / WALK_M_PER_MIN));
  return minutes < 60 ? `${minutes} min walk` : `${(meters / 1000).toFixed(1)} km away`;
}

/**
 * Cafes nearest-first with their distance. Cafes without coordinates keep their
 * relative order at the end (Array.prototype.sort is stable).
 */
export function sortByDistance(cafes: Cafe[], origin: LatLng): { cafe: Cafe; meters: number | null }[] {
  return cafes
    .map((cafe) => ({
      cafe,
      meters: cafe.lat === null || cafe.lng === null ? null : distanceMeters(origin, { lat: cafe.lat, lng: cafe.lng }),
    }))
    .sort((a, b) => (a.meters ?? Infinity) - (b.meters ?? Infinity));
}
