import { sortByBayesian } from "./ranking";
import type { Cafe } from "./types";

// Explicit column list: never select("*"). cafes_public also exposes `laptop`,
// `latte_price_cents` and `prices`, which are out of v1 and must not be read here.
export const CAFE_COLUMNS = [
  "id",
  "slug",
  "name",
  "address",
  "street_address",
  "rating",
  "rating_count",
  "lat",
  "lng",
  "neighborhood",
  "website",
  "google_maps_uri",
  "price_level",
  "business_status",
  "opening_hours",
  "restroom",
  "allows_dogs",
  "outdoor_seating",
  "reservable",
  "serves_wine",
  "ai_summary",
  "ai_summary_source",
  "google_refreshed_at",
  "is_fresh",
] as const satisfies readonly (keyof Cafe)[];

// Revalidate hourly as a fallback; the ETL also triggers /api/revalidate after each write.
export const REVALIDATE_SECONDS = 3600;
export const CAFES_TAG = "cafes";

// Stable base order from the database; the default order is applied in getCafes
// (Bayesian average rating, which needs the mean across all cafes).
const ORDER = "rating.desc.nullslast,rating_count.desc.nullslast,name.asc";

export function cafesUrl(baseUrl: string): string {
  const params = new URLSearchParams({ select: CAFE_COLUMNS.join(","), order: ORDER });
  return `${baseUrl.replace(/\/$/, "")}/rest/v1/cafes_public?${params}`;
}

export interface CafesResult {
  cafes: Cafe[];
  fetchedAt: number; // ms; seeds open/closed status in server HTML before the client clock takes over
}

export async function getCafes(): Promise<CafesResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }
  const res = await fetch(cafesUrl(url), {
    headers: { apikey: key },
    next: { revalidate: REVALIDATE_SECONDS, tags: [CAFES_TAG] },
  });
  if (!res.ok) {
    throw new Error(`cafes_public fetch failed: HTTP ${res.status}`);
  }
  const cafes = sortByBayesian((await res.json()) as Cafe[]);
  const date = Date.parse(res.headers.get("date") ?? "");
  return { cafes, fetchedAt: Number.isNaN(date) ? Date.now() : date };
}
