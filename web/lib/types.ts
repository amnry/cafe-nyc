export type TriState = boolean | null; // null = unknown, never shown as "no"

export type AiSummarySource = "generative" | "editorial" | "haiku";

export interface HoursPoint {
  day: number; // 0 = Sunday ... 6 = Saturday (Google convention)
  hour: number;
  minute: number;
}

export interface HoursPeriod {
  open: HoursPoint;
  close?: HoursPoint; // absent for 24/7 places
}

export interface Cafe {
  id: string;
  slug: string;
  name: string;
  address: string | null;
  street_address: string | null; // "204 W 10th St", from Places addressComponents
  rating: number | null;
  rating_count: number | null;
  lat: number | null;
  lng: number | null;
  neighborhood: string;
  website: string | null;
  google_maps_uri: string | null;
  price_level: number | null; // 0-4
  business_status: string | null;
  opening_hours: HoursPeriod[] | null;
  restroom: TriState;
  allows_dogs: TriState;
  outdoor_seating: TriState;
  reservable: TriState;
  serves_wine: TriState;
  ai_summary: string | null;
  ai_summary_source: AiSummarySource | null;
  google_refreshed_at: string | null;
  is_fresh: boolean | null;
  // 90-day medians of verified speed tests (cafes_public); null until a cafe has been tested.
  wifi_down_mbps: number | null;
  wifi_up_mbps: number | null;
  wifi_latency_ms: number | null;
  wifi_sample_days: number; // distinct days with an accepted test; 0 = untested
  wifi_last_tested_at: string | null;
}
