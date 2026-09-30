# Project: remote-work cafe directory (NYC)
Directory of cafes for remote workers. V1 = West Village + Greenwich Village (official NYC NTA boundaries), ~100-150 cafes.
Users filter cafes here, then click through to Google Maps. That's the whole product.

## Structure
- /etl: Python. Pulls Google Places + cafe websites, Haiku extraction (prices, fallback summary), upserts to Supabase.
- /web: Next.js (App Router, TypeScript, Tailwind). Reads from Supabase.
- /supabase/migrations: all schema changes as SQL migrations.

## Decisions (do not change without asking)
- Card icons: restroom / dogs, each tri-state yes | no | unknown. Unknown is never shown as no.
- Card: name, $ level, restroom + dogs icons, open now + closing time, Google Maps button. No prices on the card.
- Detail drawer: AI summary (with Google attribution), coffee prices (only when found), outdoor seating, food/wine, reservable, website.
- Filters: restroom, dogs, open now, price level.
- Laptop data is not shown anywhere in v1. The laptop* DB columns stay (no migration) but the ETL does not fill them and the site must not read them.
- Neighborhood = whichever NTA polygon (West Village or Greenwich Village) contains the cafe; boundaries in /etl/data. Cafes outside both are skipped.
- Grid view default; map (Google Maps JS) lazy-loaded only when user opens it.
- All times computed in America/New_York.
- Never store raw Google review text. The ETL does not even fetch reviews; store only derived labels.
- ETL runs biweekly; Google data must not be older than 30 days.
- Secrets live in .env files, never committed.

## Out of scope for v1
Laptop policy and WiFi (both return later with the speed test), share button, laptop time-limit policies, other neighborhoods, serves_food extraction.
