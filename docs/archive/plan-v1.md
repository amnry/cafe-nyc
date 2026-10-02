# v1 Supabase schema — cafe-nyc

## v1 scope changes (supersede anything below)
- **Laptop removed from v1.** Columns `laptop`, `laptop_evidence`, `laptop_confidence`, `laptop_override` stay in the DB (no migration); ETL doesn't write them (rows get the default `'unknown'`) and the site never reads them. Laptop + WiFi return later with the speed test. The `cafes_public` view still exposes `laptop` and `latte_price_cents` (no migration); the web app must ignore both.
- **Card has no latte price.** Card = name, $ level, restroom + dogs icons, open/closing time, Maps button. Prices appear only in the drawer, when found (`prices` jsonb).
- **Neighborhoods** = official 2020 NTA polygons for West Village (MN0203) and Greenwich Village (MN0202), `etl/data/nta_west_greenwich_village.geojson`. `cafes.neighborhood` holds the containing NTA's name; cafes outside both are skipped.
- **ETL** does not fetch reviews or reviewSummary. Haiku extracts prices and a fallback summary from the website only.

## Context
Repo `/Users/amanarya/cafe-nyc` has only CLAUDE.md, LICENSE, .gitignore; `supabase/` is empty. Need the v1 schema that the ETL (service role) writes and the Next.js site (anon / `sb_publishable_` key) reads. Constraints from CLAUDE.md: tri-state booleans (null = unknown, never shown as no), money in integer cents, no raw review text, secrets never committed.

## Setup (before migration)
- `supabase init` in repo root → creates `supabase/config.toml` (commit it; no secrets in it).
- Migration file: `supabase/migrations/<YYYYMMDDHHMMSS>_init_schema.sql` (CLI timestamp naming so `db push` orders it).
- Remote push needs `supabase login` (interactive — user runs `! supabase login`) + `supabase link --project-ref gndmwpansekqzxfekrrc` (asks DB password).

## Migration contents (single file, in order)

**1. `set_updated_at()` trigger function** — `new.updated_at = now()`; trigger `before update` on `cafes`.

**2. `cafes`**
- `id uuid pk default gen_random_uuid()`, `google_place_id text unique not null`, `slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`, `name text not null`, `address text`, `lat double precision`, `lng double precision`, `neighborhood text not null`, `website text`, `google_maps_uri text`
- `rating numeric(2,1) check 0–5`, `rating_count int check >= 0`
- `price_level smallint check between 0 and 4` (ETL maps Google `PRICE_LEVEL_FREE..VERY_EXPENSIVE` → 0..4)
- `business_status text check in ('OPERATIONAL','CLOSED_TEMPORARILY','CLOSED_PERMANENTLY')` nullable (Google enum verbatim)
- `opening_hours jsonb` (Google `regularOpeningHours.periods`, stored as-is)
- `restroom, allows_dogs, outdoor_seating, reservable, serves_wine, serves_food boolean` — nullable, no default (null = unknown)
- `ai_summary text`, `ai_summary_source text check (ai_summary_source in ('generative','editorial','haiku'))` nullable (null = no summary). Frontend shows the Google "Summarized with Gemini" label off this field, so a typo must fail at insert, not silently drop attribution
- `laptop text not null default 'unknown' check in ('yes','no','unknown')`, `laptop_evidence text`, `laptop_confidence real check between 0 and 1`, `laptop_override text check in ('yes','no','unknown')` nullable
- `google_refreshed_at timestamptz`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`

**3. `menu_prices`**
- `id uuid pk`, `cafe_id uuid not null references cafes(id) on delete cascade`, `item text not null check in ('latte','americano','cappuccino','matcha','drip')`, `price_cents int not null check > 0`, `source_url text`, `observed_at timestamptz not null default now()`
- `unique (cafe_id, item)` (also serves as the cafe_id index; ETL upserts `on conflict (cafe_id, item)`)

**4. `etl_runs`**
- `id uuid pk`, `started_at timestamptz not null default now()`, `finished_at timestamptz`, `cafes_processed int not null default 0`, `errors jsonb not null default '[]'`

**5. View `cafes_public`**
Columns: id, slug, name, address, lat, lng, neighborhood, website, google_maps_uri, rating, rating_count, price_level, business_status, opening_hours, restroom, allows_dogs, outdoor_seating, reservable, serves_wine, serves_food, ai_summary, ai_summary_source, `coalesce(laptop_override, laptop) as laptop`, `latte_price_cents`, `prices jsonb` (`jsonb_object_agg(item, price_cents)` via lateral subquery, `'{}'` when none), `google_refreshed_at`, `(google_refreshed_at >= now() - interval '30 days') as is_fresh`.
Filter: `where business_status is distinct from 'CLOSED_PERMANENTLY' and business_status is distinct from 'CLOSED_TEMPORARILY'` (keeps OPERATIONAL + null/unknown).
Excluded on purpose: laptop_evidence, laptop_confidence, laptop_override, google_place_id, created_at/updated_at (internal; not in card/drawer spec).

**6. Security**
- `alter table ... enable row level security` on cafes, menu_prices, etl_runs. **No policies** → anon/authenticated denied; service_role bypasses RLS (ETL writes work).
- `revoke all on cafes, menu_prices, etl_runs from anon, authenticated` (Supabase default privileges grant them; RLS alone is one layer, revoke is the second).
- `grant select on cafes_public to anon, authenticated`.
- View is created **without** `security_invoker` (runs as owner `postgres`) — that's what lets anon read the view while base tables stay locked. Supabase's linter will flag "security definer view"; that's intentional here and safe because the view only exposes whitelisted columns and is read-only.

## ETL contract: slugs (for /etl, not in migration)
- Slug = slugified `name` + street name, e.g. Joe Coffee at 141 Waverly Pl → `joe-coffee-waverly-pl`. Chains have several NYC locations, so name alone collides.
- Street derived from `address`: first comma segment, drop leading house number (`141 Waverly Pl` → `Waverly Pl`), lowercase, ASCII-fold, non-alphanumerics → `-`, collapse/trim dashes.
- Fallback if name+street still collides (two same-name cafes on one street): append house number (`joe-coffee-waverly-pl-141`). If address missing/unparseable: append first 8 chars of `google_place_id`.
- Slug set on insert only; upsert `on conflict (google_place_id)` must NOT overwrite slug, so URLs stay stable if a name or address is edited on Google.
- DB `unique` + format check is the backstop; ETL must fail the row loudly on violation, never retry with random suffix.
- `ai_summary_source` must be one of `generative | editorial | haiku`; ETL uses a shared constant, not string literals.

## Choices I'd change vs. the spec (and did, above)
1. **`is_fresh` computed in the view, not a stored column** — a stored flag goes stale the moment time passes; computing from `google_refreshed_at` is always correct. (Per your call, stale rows stay visible.)
2. **`prices jsonb` in the view** — drawer needs other coffee prices; anon can't touch `menu_prices`.
3. **Closed = both TEMPORARILY and PERMANENTLY excluded; null status kept** — unknown shouldn't hide a cafe.
4. **`laptop` not null default 'unknown'** — tri-state lives in the value, so null would be a 4th state.
5. **Check constraints on price_level (0–4), rating (0–5), confidence (0–1), price_cents (>0), business_status enum** — cheap guards against ETL mapping bugs.
6. **No `updated_at` on menu_prices** — `observed_at` is the meaningful timestamp; ETL sets it on upsert.
7. **"Open now + closing time" computed in the web layer (America/New_York), not SQL** — parsing Google periods jsonb in SQL is doable but brittle; view passes `opening_hours` raw.
8. **No PostGIS / extra indexes** — ~100 rows; unique constraints already index the lookup keys.

Note: Google Places ToS caps caching of most fields at 30 days; showing stale rows is your call, `is_fresh` lets the UI badge or dim them.

## Verification
1. Local: `supabase start` (Docker present) → `supabase db reset` applies migration cleanly.
2. SQL checks locally: insert a cafe + prices as service role; `select * from cafes_public` shows latte_price_cents, prices jsonb, override coalescing, is_fresh; a CLOSED_PERMANENTLY cafe is absent.
2b. Constraint checks: insert with `ai_summary_source = 'gemini'` (typo) → rejected; duplicate slug → rejected; slug `Joe Coffee` (uppercase/space) → rejected.
3. Anon checks (local anon key, then remote publishable key after push): `GET /rest/v1/cafes_public` → 200; `GET /rest/v1/cafes`, `/menu_prices`, `/etl_runs` → 401/permission denied; `POST /rest/v1/cafes` → denied.
4. Remote: `supabase link` → `supabase db push --dry-run` → `supabase db push`.
5. Commit `supabase/config.toml` + migration only after local checks pass (ask before push).
