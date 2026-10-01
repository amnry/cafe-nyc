import type { Cafe } from "./types";

// Explicit column list: never select("*"). cafes_public also exposes `laptop`,
// `latte_price_cents` and `prices`, which are out of v1 and must not be read here.
export const CAFE_COLUMNS = [
  "id",
  "slug",
  "name",
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

// Revalidate hourly; the ETL only runs biweekly.
export const REVALIDATE_SECONDS = 3600;

export function cafesUrl(baseUrl: string): string {
  const params = new URLSearchParams({ select: CAFE_COLUMNS.join(","), order: "name" });
  return `${baseUrl.replace(/\/$/, "")}/rest/v1/cafes_public?${params}`;
}

export async function getCafes(): Promise<Cafe[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set");
  }
  const res = await fetch(cafesUrl(url), {
    headers: { apikey: key },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) {
    throw new Error(`cafes_public fetch failed: HTTP ${res.status}`);
  }
  return (await res.json()) as Cafe[];
}
