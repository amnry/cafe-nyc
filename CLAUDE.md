# Project: remote-work cafe directory (NYC)
Directory of cafes for remote workers. V1 = West Village only, ~100 cafes.
Users filter cafes here, then click through to Google Maps. That's the whole product.

## Structure
- /etl: Python. Pulls Google Places + cafe websites, Haiku extraction, upserts to Supabase.
- /web: Next.js (App Router, TypeScript, Tailwind). Reads from Supabase.
- /supabase/migrations: all schema changes as SQL migrations.

## Decisions (do not change without asking)
- Card icons: laptop / restroom / dogs, each tri-state yes | no | unknown. Unknown is never shown as no.
- Card: name, $ level, latte price, 3 icons, open now + closing time, Google Maps button.
- Detail drawer: AI summary (with Google attribution), other coffee prices, outdoor seating, food/wine, reservable, website.
- Filters: laptop OK, restroom, dogs, open now, price level.
- Grid view default; map (Google Maps JS) lazy-loaded only when user opens it.
- All times computed in America/New_York.
- Never store raw Google review text. Store only derived labels and a short evidence line.
- ETL runs biweekly; Google data must not be older than 30 days.
- Secrets live in .env files, never committed.

## Out of scope for v1
WiFi speed test, share button, laptop time-limit policies, other neighborhoods.
