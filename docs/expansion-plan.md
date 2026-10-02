# Expansion prep: Nearby-Search ETL, 21 NTAs, cost dry run

## Context
V1 covers West Village + Greenwich Village. Expansion target: Manhattan south of 59th St plus 5 areas in Brooklyn and Queens. Today the ETL runs Nearby Search with an ids-only mask, then a Place Details call (Enterprise + Atmosphere, with `reviews`) for each cafe, then Haiku when Google has no summary. At about 20x the cafe count that gets expensive and slow. Plan: one Nearby Search with the full mask, adaptive subdivision, no Haiku. Then a **zero-cost** dry run that estimates circles, calls, cost and cafes, and a stop for review.

**Answers already given:** outer areas = core only. Names = short labels. Frontend (#6) = Phase B, after review.

## Order (strict)
1. Save this plan as `docs/expansion-plan.md`; `git mv plan.md docs/archive/plan-v1.md` (root plan.md = v1 schema plan).
2. Phase A: ETL code + estimator. Run estimator. **STOP for review.**
3. Phase B: frontend. Ship it.
4. Then: set `--max-calls` default from reviewed estimate, switch workflow, first real `--write` run.
**Never write expanded data to production before Phase B ships.** Guard: the workflow change (below) lands in step 4, not Phase A, so the scheduled run on the 15th keeps doing `--all-existing` over WV/GV only. `--all-existing` keeps working in Phase A (Details per stored cafe, same as today, minus Haiku).

**Important:** today `run.py` "dry run" already makes Google calls; it only skips writes. The dry run here is a separate estimator that makes **no Google or Anthropic calls**. It reads only free sources: NYC Open Data and our own Supabase.

## Current pricing (verified today, developers.google.com/maps/billing-and-pricing/pricing)
| SKU | per 1k | free/month |
|---|---|---|
| Nearby Search Enterprise + Atmosphere | $40 | 1,000 |
| Place Details Enterprise + Atmosphere | $25 | 1,000 |
| Nearby Search Pro (current discovery) | $32 | 5,000 |

Fields that put a call in the E+A tier: restroom, allowsDogs, outdoorSeating, reservable, servesWine, generativeSummary, editorialSummary. So every Nearby call with the full mask is billed at $40/1k, including calls that return 0 results.

## Target NTAs (2020, dataset 9nt8-h7nd) → short label
Manhattan, 16 areas: MN0101 FiDi/Battery Park City, MN0102 Tribeca, MN0201 SoHo, MN0202 Greenwich Village, MN0203 West Village, MN0301 Chinatown, MN0302 Lower East Side, MN0303 East Village, MN0401 Chelsea, MN0402 Hell's Kitchen, MN0501 Flatiron/Union Sq, MN0502 Midtown, MN0601 Stuy Town, MN0602 Gramercy, MN0603 Murray Hill/Kips Bay, MN0604 Turtle Bay.
Excluded: MN0191 (the park/islands area), MN0661 (UN).
Outer, 5 areas: BK0101 Greenpoint, BK0102 Williamsburg, BK0201 Brooklyn Heights, BK0202 DUMBO/Downtown BK, QN0201 Long Island City.
I'll finalize the labels during implementation; you can rename them in the config map. WV and GV keep their current strings, so existing rows don't change.

## Phase A — ETL (stop after the dry-run report)

### 1. Boundaries + config
- New `etl/scripts/fetch_ntas.py` (free) writes `etl/data/nta_targets.geojson`, filtered to the 21 NTA codes. It keeps the `nta2020` code, the official name, and the short label. Commit the data file. Leave the old WV/GV file in place until Phase B ships.
- `etl/config.py`: `TARGET_NTAS = {code: label}`, `NTA_FILE` → new file, `COARSE_RADIUS_M`, `MIN_RADIUS_M = 50`, plus a `PRICING` dict (the table above, with a date) that the estimator uses.
- `etl/geo.py`: `neighborhoods()` returns the label. Replace the 8-point `_touches_scope` with an exact circle–polygon intersection test: the center is inside the polygon, or the distance to some edge is ≤ r, computed on a local equirectangular projection. 8-point sampling can miss thin parts of NTAs at large radii.

### 2. Nearby Search with the full mask (`etl/places.py`)
- `NEARBY_MASK` = `places.` + today's `DETAILS_MASK` fields, **minus `reviews`**. Reviews were only used for Haiku. Removing them doesn't change the SKU, but it brings the ETL in line with CLAUDE.md ("does not even fetch reviews").
- `nearby()` uses that mask, keeps `includedPrimaryTypes` cafe/coffee_shop, and adds `rankPreference: DISTANCE` so the results inside a capped circle are the closest ones.
- **Fix the existing `split_circle` bug.** Today it makes 4 circles of r/2 at (±r/2, ±r/2), which leaves gaps: e.g. (0.9r, 0) is 0.64r from the nearest child center. New split: child radius **r/√2** at (±r/2, ±r/2). Each child covers a quadrant square, so the parent disk is fully covered.
- `discover()`: recurse on `len == 20` while `child_r ≥ MIN_RADIUS_M`. Drop the depth cap. Drop children that don't touch any target NTA. If a circle at the 50 m floor still hits 20, record it as a warning in `etl_runs.errors`. Return the full place dicts plus per-run stats: calls by depth, saturated leaves.
- `details()` stays (mask without reviews). It is used only for existing cafes that no search found.

### 3. Pipeline (`etl/run.py`)
- `process()` takes the place dict from discovery instead of calling `details()`. Everything else is reused unchanged: `is_unclear_name`, `auto_hide_reason`, `build_row`, the slug logic, and the rule that manual hides are kept.
- After discovery, `missing = existing place_ids whose stored neighborhood is in scope − found`. For each one, call `details()` and run the same `process()`. This catches CLOSED_PERMANENTLY and businesses that changed type.
- `--names` / `--place-ids` / `--all-existing` paths: `details()` per cafe as today.
- **`--max-calls N`**: `Places._request` checks `stats.google_total` before each HTTP attempt (retries counted, conservative); over the limit → raise `CallBudgetExceeded`, run aborts, error goes into `etl_runs.errors`, exit 1. Discovery finishes before any write, so an abort in discovery writes nothing. Default = `config.MAX_GOOGLE_CALLS`, a committed constant set in step 4 to round(1.5 × estimator mid calls per refresh). Until then it defaults to today's WV/GV scale (estimator also prints that number), so a misfire can't overspend.

### 4. Haiku summary fallback off
- `pick_summary`: generative → editorial → None. Remove the `haiku.analyze` call from the default path. `ANTHROPIC_API_KEY` is required only with `--with-websites`, which keeps the price extraction behind its flag.
- On the next write, existing `ai_summary_source='haiku'` rows get null (they were hidden on the site anyway). No migration needed: the check constraint still allows 'haiku'.
- Delete the summary prompt and review code from `haiku.py` (`SYSTEM_SUMMARY`, `review_texts`, `copies_review`, `check_summary`) and the related tests in `test_quality.py`.

### 5. Estimator — `etl/estimate.py` (no paid calls; never reads `GOOGLE_PLACES_API_KEY`)
- **Proxy density:** pull DOHMH Restaurant Inspections (Open Data `43nn-pn8j`) with `cuisine_description='Coffee/Tea'` that have lat/lng, dedupe by `camis`, and keep points inside the target NTAs.
- **Calibration:** k = (our stored WV+GV cafe count, hidden ones included, read from Supabase) ÷ (DOHMH coffee points in WV+GV). Report a band of k×0.7 to k×1.3, because DOHMH misses some Google cafes and counts some non-cafes.
- **Simulation:** run the real `geo.grid_circles` + `split_circle` + touch test on the proxy points. A circle "returns" min(20, k·count) and splits if that value is 20. This exercises the same code the paid run will use.
- Sweep `COARSE_RADIUS_M` ∈ {250, 400, 600, 800} and pick the one with the fewest calls.
- **Output (table + JSON in the scratchpad):**
  - coarse circles; total calls; calls by depth; saturated leaves at 50 m
  - billable calls by SKU per refresh: Nearby E+A = circle calls; Place Details E+A = existing in-scope cafes missing from the search (estimated from the WV/GV churn rate, default 3%)
  - monthly cost, per SKU, low/mid/high k, cost = max(0, calls in a calendar month − free cap) × price (free cap resets monthly, so compute per month, not on averages):
    - schedule A, 2 refreshes/month (1st + 15th)
    - schedule B, weekly check, refresh only if last successful run ≥ 23 days old: ~1.2 refreshes/month on average; show typical month (1 run) and worst month (2 runs), plus the 12-month total
  - suggested `--max-calls` = 1.5 × mid calls per refresh
  - estimated cafe count per neighborhood (low/mid/high), plus the estimated share hidden by the auto rules (WV/GV hidden ratio)
  - Anthropic: $0
- Stop here and report.

### Tests (pytest, no network)
- `split_circle` coverage: sample 1,000 points in the parent disk; each must fall in some child.
- Circle–polygon touch: inside, edge-crossing, disjoint.
- `discover()` with a fake `Places` that saturates: recurses to the floor, stops at 50 m, dedupes.
- The missing-cafe path calls `details()` only for ids not found.
- `pick_summary` never returns 'haiku'; the default run never builds an Anthropic client.
- `test_grid_covers_scope_and_is_sane`: update the circle bounds and sample points from Brooklyn and LIC.
- The estimator runs on a fixture of points, with `GOOGLE_PLACES_API_KEY` unset.

### CLAUDE.md (Phase A)
Update: scope (21 NTAs, short labels), Neighborhood rule, Summaries (no Haiku fallback), ETL = Nearby Search with the full mask + adaptive subdivision. Remove "other neighborhoods" from out of scope.

## Phase B — frontend (only after you review Phase A)
- **Neighborhood picker:** a searchable multi-select combobox that replaces the neighborhood chips in `web/components/FilterBar.tsx`. It reuses `Filters.neighborhoods` in `web/lib/filters.ts`, shows a count per neighborhood, and is keyboard-accessible (listbox pattern).
- **Clustering:** add `@googlemaps/markerclusterer` in `web/components/CafeMap.tsx`, using the existing Advanced Markers and a custom renderer (amber fill, ink count). Clicking a cluster zooms in. Pin hover behaves as today.
- **Pagination (done early, before Phase B):** `web/components/CafeBrowser.tsx` grid shows 20, then "Show more" (+20, same list grows). The count resets when filters, query, near-me or the view change. The map and "Surprise me" still use the full `visible` list.
- **Payload check:** about 2k cafes in the RSC props. Measure the HTML size; consider trimming `opening_hours` later if it's large.
- CLAUDE.md filter list: add the neighborhood picker.

## Step 4 — switch-over (after Phase B ships)
- `config.MAX_GOOGLE_CALLS` = reviewed number.
- `.github/workflows/etl.yml`: refresh step runs `python etl/run.py --write --max-calls ...` (Nearby discovery, no `--all-existing`); manual dry_run input → `--dry-run`. Drop `ANTHROPIC_API_KEY` from env (only `--with-websites` needs it).
- Schedule per your pick: A keeps `cron: "0 9 1,15 * *"`. B = weekly cron + `run.py --if-stale-days 23`: reads latest successful `etl_runs` (finished_at set, cafes_processed > 0, no `aborted:` error; per-cafe "skipped:" errors are normal and don't count as failure), exits 0 without Google calls if newer. 23 days + up to 7 waiting keeps data ≤ 30 days (is_fresh).
- First real write run via manual dispatch, watched.

## Verification (Phase A)
1. `cd etl && pytest`
2. `python estimate.py` with `GOOGLE_PLACES_API_KEY` and `ANTHROPIC_API_KEY` unset in the environment, to prove it makes no paid calls. Check that the output table has every number from item 5.
3. Sanity-check the simulation: WV+GV alone should give a cafe count within the k band of what's in the DB.
4. No `run.py` run against Google until you approve the estimate.
