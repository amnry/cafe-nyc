# Project: remote-work cafe directory (NYC)
Production: https://3rdplacenyc.com (Vercel, root directory `web`; cafe-nyc.vercel.app is the Vercel alias).
Directory of cafes for remote workers. V1 = West Village + Greenwich Village (official NYC NTA boundaries), ~100-150 cafes.
Users filter cafes here, then click through to Google Maps. That's the whole product.

## Structure
- /etl: Python. Pulls Google Places + cafe websites, Haiku fallback summary only, upserts to Supabase.
- /web: Next.js (App Router, TypeScript, Tailwind). Reads from Supabase.
- /supabase/migrations: all schema changes as SQL migrations.

## Decisions (do not change without asking)
- Card icons: restroom / dogs / outdoor seating (Lucide Toilet / Dog / Trees), each tri-state yes | no | unknown. yes = ink with amber glow, no = dimmed + slash, unknown = not rendered (never shown as no). Filter chips for restroom and dogs reuse the icons.
- Card: name, rating, $ level, restroom + dogs + outdoor icons, open now + closing time, WiFi line, Google Maps button. WiFi line: tested = "↓ 85 ↑ 20 Mbps · 4 days" ("early data" when under 3 days); untested = small muted "WiFi untested", no call to action on the card. WiFi never affects ranking or completeness.
- Detail drawer: AI summary, outdoor seating, wine, reservable, website. Food is out of scope. Only ai_summary_source = 'generative' gets the footnote "The description above: Summarized with Gemini" (drawer only, below the Maps button; never on the card). Rows with is_fresh = false stay visible with a small "may be outdated" note.
- Filters: restroom, dogs, open now, price level.
- Search bar above the filters: client-side Fuse.js over name, street_address, neighborhood; debounced, in the URL as ?q=, combines with filters, same in grid and map.
- Grid shows 24 cafes; a "Show more" button at the bottom grows the same list by 24 (no page numbers). Resets to 24 when filters, search, near-me or view change. Map and "Surprise me" use the full list.
- Header: line under the tagline "WiFi speeds are crowdsourced from people working there. How it works ↓" and a small muted "FAQ" link top right, both jumping to the FAQ at the bottom of the page (web/components/Faq.tsx). FAQ is plain-language, business tone (no internal thresholds or anti-abuse details); every claim must stay true to the WiFi spec.
- Laptop data is not shown anywhere in v1. The laptop* DB columns stay (no migration) but the ETL does not fill them and the site must not read them.
- Prices are not shown or read anywhere in v1. The menu_prices table and cafes_public.prices / latte_price_cents stay (no migration); the ETL's website fetch + price extraction is behind `--with-websites`, off by default. The web app must not read prices, latte_price_cents, or laptop.
- Summaries: only Google's (generative/editorial) are shown. Haiku fallbacks are generated from reviews only (never restating restroom/dogs/outdoor/wine, null if unsupported) but hidden on the site.
- Exclusions: cafes.hidden (filtered out of cafes_public). hidden_reason 'auto: ...' is set/cleared by the ETL (name contains "access required", primaryType restaurant/bar, summary says takeout-only, fewer than 5 reviews, no opening hours); 'manual: ...' is set by hand and the ETL never overrides it.
- Address line on the site = cafes.street_address (street number + route from addressComponents).
- Neighborhood = whichever NTA polygon (West Village or Greenwich Village) contains the cafe; boundaries in /etl/data. Cafes outside both are skipped.
- Theme: one look on every device (no prefers-color-scheme), from the share image: amber #ffb224 page, receipt-paper cards (#fbfaf6), ink #1a1203; amber is a fill, never text on paper. Grid view default; map (Google Maps JS) lazy-loaded only when user opens it; hovering a pin with a mouse shows that cafe's card (amber-tinted). View lives in the URL (?view=map). Base map is visually muted; pins carry the color. Key: NEXT_GOOGLE_MAPS_API_KEY (passed from the server; must be HTTP-referrer restricted).
- Default order: Bayesian average rating, (v/(v+m))*R + (m/(v+m))*C with m=50, C=mean rating, v=review count, plus COMPLETENESS_WEIGHT (0.3) * completeness, where completeness = (non-null restroom, dogs, outdoor + 1 if a Google summary is shown) / 4. "Near me" sorts by distance with "N min walk" (~80 m/min); on by default only if geolocation permission was already granted. Near-me location stays in browser memory: never sent, logged, or stored. The only exception is the WiFi speed test: location is sent once, to /api/speedtest/start, when the user taps Test; it is used for the geofence and discarded, and only distance_m and accuracy_m are stored.
- All times computed in America/New_York.
- WiFi speed test (spec: docs/wifi-spec.md, plan: docs/wifi-plan.md; spec is the source of truth). Runs in the browser on explicit tap; results are client-reported, so trust comes from layered checks and aggregation, not any one check. Never store the raw IP (only HMAC of the /24 or /48) or coordinates. Disclosure line under the Test button: "We store the speeds, the distance from the cafe, and your network provider. Your location and IP address are not stored." Reads on the site go through cafes_public wifi_* columns only; speed_tests and speed_test_starts have no anon access (service role from the API only). Tested cafes show up on the card; "Be the first to test" lives in the drawer, with a one-line crowdsourced note above the button and "Visitor-tested" on the drawer WiFi row; the near-me banner ("Looks like you're at X. Test the WiFi?") is the main call to action.
- Never store raw Google review text. The ETL does not even fetch reviews; store only derived labels.
- ETL runs biweekly; Google data must not be older than 30 days.
- Secrets live in .env files, never committed.

## Out of scope for v1
Menu prices (ETL code kept behind a flag), laptop policy (returns later), share button, laptop time-limit policies, other neighborhoods, serves_food extraction.
