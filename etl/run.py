"""cafe-nyc ETL.

  python run.py --names "A,B,C"    Text Search over both neighborhoods (testing)
  python run.py --place-ids "X,Y"  Skip search, use exact Google place ids
  python run.py                    Nearby Search grid discovery over West Village + Greenwich Village

Both feed the same pipeline: place details -> Haiku (fallback summary) -> upsert.
Website fetching and price extraction are off; enable with --with-websites.
Dry-run is the default; nothing is written to Supabase without --write.
"""
import argparse
import os
import sys
from urllib.parse import urlparse
from datetime import datetime, timezone

import anthropic
import requests

import config
import geo
import haiku
from address import street_line
from classify import auto_hide_reason, is_unclear_name, lookalike_flags
from config import CAFE_PRIMARY_TYPES, SUMMARY_EDITORIAL, SUMMARY_GENERATIVE, SUMMARY_HAIKU
from places import PRICE_LEVELS, Places, discover
from slug import build_slug, slugify
from stats import Stats
from store import Store
from website import fetch_site


def pick_summary(place: dict, analysis: haiku.Analysis) -> tuple[str | None, str | None]:
    s = haiku.google_summaries(place)
    if s["generative"]:
        return s["generative"], SUMMARY_GENERATIVE
    if s["editorial"]:
        return s["editorial"], SUMMARY_EDITORIAL
    if analysis.summary:
        return analysis.summary, SUMMARY_HAIKU
    return None, None


def build_row(place: dict, analysis: haiku.Analysis, summary, source, neighborhood: str) -> dict:
    loc = place.get("location") or {}
    return {
        "google_place_id": place["id"],
        "name": place["displayName"]["text"],
        "address": place.get("formattedAddress"),
        "street_address": street_line(place.get("addressComponents")),
        "lat": loc.get("latitude"),
        "lng": loc.get("longitude"),
        "neighborhood": neighborhood,
        "website": place.get("websiteUri"),
        "google_maps_uri": place.get("googleMapsUri"),
        "rating": place.get("rating"),
        "rating_count": place.get("userRatingCount"),
        "price_level": PRICE_LEVELS.get(place.get("priceLevel")),
        "business_status": place.get("businessStatus"),
        "opening_hours": (place.get("regularOpeningHours") or {}).get("periods"),
        # tri-state: key absent in Google's response -> None (unknown), never False
        "restroom": place.get("restroom"),
        "allows_dogs": place.get("allowsDogs"),
        "outdoor_seating": place.get("outdoorSeating"),
        "reservable": place.get("reservable"),
        "serves_wine": place.get("servesWine"),
        # serves_food and the laptop_* columns are intentionally not written (out of v1 scope)
        "ai_summary": summary,
        "ai_summary_source": source,
        "google_refreshed_at": datetime.now(timezone.utc).isoformat(),
    }


def tri(v) -> str:
    return "unknown" if v is None else ("yes" if v else "no")


def name_matches(query: str, found: str) -> bool:
    q, f = set(slugify(query).split("-")), set(slugify(found).split("-"))
    return bool(q) and len(q & f) / len(q) >= 0.5


class OutOfScope(Exception):
    pass


def process(place_id: str, places: Places, client, stats: Stats, existing: dict, taken: set,
            with_websites: bool = False):
    """Shared pipeline. Returns (row, prices, analysis, meta) for report/upsert."""
    place = places.details(place_id)
    if is_unclear_name((place.get("displayName") or {}).get("text"), place.get("formattedAddress")):
        raise OutOfScope(f"{place_id} | {place.get('formattedAddress')} has an unclear name "
                         f"{(place.get('displayName') or {}).get('text')!r}")
    loc = place.get("location") or {}
    neighborhood = geo.neighborhood_for(loc.get("latitude", 0), loc.get("longitude", 0))
    if neighborhood is None:
        raise OutOfScope(f"{place['displayName']['text']} | {place.get('formattedAddress')} is outside "
                         "West Village / Greenwich Village NTAs")
    pages = fetch_site(place.get("websiteUri"), stats) if with_websites else []
    g = haiku.google_summaries(place)
    analysis = haiku.analyze(client, stats, place, pages, need_summary=not (g["generative"] or g["editorial"]),
                             extract_prices=with_websites)
    summary, source = pick_summary(place, analysis)
    row = build_row(place, analysis, summary, source, neighborhood)

    is_new = place_id not in existing
    if is_new:
        row["slug"] = build_slug(row["name"], row["address"], place_id, taken)
        taken.add(row["slug"])
    else:
        # Re-send the stored slug unchanged. Omitting it fails: Postgres checks NOT NULL on the
        # proposed INSERT row before ON CONFLICT DO UPDATE runs. Slugs are still never rebuilt.
        row["slug"] = existing[place_id]["slug"]
    slug = row["slug"]

    # Visibility. A manual decision (hidden_reason 'manual: ...') is never overridden.
    stored_reason = (existing.get(place_id) or {}).get("hidden_reason") or ""
    g = haiku.google_summaries(place)
    auto = auto_hide_reason(row["name"], place.get("primaryType"), [g["generative"], g["editorial"], row["ai_summary"]])
    if not stored_reason.startswith("manual"):
        row["hidden"] = auto is not None
        row["hidden_reason"] = auto
    meta = {
        "slug": slug, "is_new": is_new, "pages": pages, "with_websites": with_websites,
        "visibility": stored_reason if stored_reason.startswith("manual") else (auto or "shown"),
        "primary_type": place.get("primaryType"),
        "lookalike": lookalike_flags(row["name"], place.get("types")),
    }
    return row, analysis, meta


def report(i: int, n: int, query: str | None, row: dict, a: haiku.Analysis, meta: dict):
    print(f"\n[{i}/{n}] {query or row['name']}")
    print(f"  match:    {row['name']} | {row['address']}")
    if query and not name_matches(query, row["name"]):
        print("  WARNING:  NAME MISMATCH")
    print(f"  area:     {row['neighborhood']}  |  street: {row['street_address']}")
    print(f"  visible:  {meta['visibility']}")
    print(f"  type:     {meta['primary_type']}")
    if meta["lookalike"]:
        print(f"  REVIEW:   {', '.join(meta['lookalike'])}")
    print(f"  place id: {row['google_place_id']}")
    print(f"  slug:     {meta['slug']} ({'new' if meta['is_new'] else 'existing, kept'})")
    pl = row["price_level"]
    print(f"  price:    {'unknown' if pl is None else '$' * max(pl, 1) + f' (level {pl})'}")
    print(f"  icons:    restroom={tri(row['restroom'])}  dogs={tri(row['allows_dogs'])}")
    if meta["with_websites"]:
        if a.prices:
            print("  prices:   " + "; ".join(f"{p['item']} ${p['price_cents'] / 100:.2f} <{p['source_url']}>" for p in a.prices))
        else:
            print("  prices:   none found")
        chars = sum(len(p.text) for p in meta["pages"])
        print(f"  website:  {len(meta['pages'])} page(s), {chars:,} chars")
    print(f"  summary:  source={row['ai_summary_source']}" + (f"  \"{row['ai_summary']}\"" if row["ai_summary_source"] == "haiku" else ""))
    for f in a.flags:
        print(f"  flag:     {f}")


def refresh_site(errors: list[str]) -> None:
    """Ask the site to drop its cached cafe list now instead of waiting out the hourly ISR window."""
    secret = os.environ.get("REVALIDATE_SECRET")
    url = os.environ.get("SITE_URL", "https://3rdplacenyc.com").rstrip("/") + "/api/revalidate"
    if not secret:
        print("site refresh: skipped (REVALIDATE_SECRET not set); new data shows within an hour")
        return
    try:
        r = requests.post(url, headers={"Authorization": f"Bearer {secret}"}, timeout=30)
        print(f"site refresh: HTTP {r.status_code}")
        if not r.ok:
            errors.append(f"site refresh failed: HTTP {r.status_code}")
    except requests.RequestException as e:
        print(f"site refresh: failed ({type(e).__name__})")
        errors.append(f"site refresh failed: {type(e).__name__}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--names", help='comma-separated cafe names, e.g. "A,B,C"')
    ap.add_argument("--with-websites", action="store_true",
                    help="fetch cafe websites and extract menu prices (off by default; prices are out of v1)")
    ap.add_argument("--place-ids", help="comma-separated Google place ids; skips Text Search (use when a name is ambiguous)")
    ap.add_argument("--all-existing", action="store_true", help="re-run every cafe already in the database")
    ap.add_argument("--limit", type=int, help="process at most N targets (discovery: alphabetical by name)")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--write", action="store_true", help="upsert to Supabase (default is dry-run)")
    g.add_argument("--dry-run", action="store_true", help="explicit dry-run (the default)")
    args = ap.parse_args()

    config.load_env()
    env = config.require_env("GOOGLE_PLACES_API_KEY", "ANTHROPIC_API_KEY",
                             "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL")
    stats = Stats()
    places = Places(env["GOOGLE_PLACES_API_KEY"], stats)
    client = anthropic.Anthropic(api_key=env["ANTHROPIC_API_KEY"])
    store = Store(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])
    existing = store.existing()
    taken = {e["slug"] for e in existing.values()}

    # Resolve targets: list of (query or None, place_id)
    targets: list[tuple[str | None, str]] = []
    errors: list[str] = []
    if args.all_existing:
        targets = [(None, pid) for pid in sorted(existing)]
    elif args.place_ids:
        targets = [(None, pid.strip()) for pid in args.place_ids.split(",") if pid.strip()]
    elif args.names:
        for name in (n.strip() for n in args.names.split(",") if n.strip()):
            results = places.text_search(name)
            if not results:
                errors.append(f"{name}: no Text Search match")
                print(f"\n[no match] {name}")
                continue
            targets.append((name, results[0]["id"]))
            others = [r.get("formattedAddress", "?") for r in results[1:3]]
            if others:
                print(f"note: {name!r} other candidates: " + " || ".join(others))
    else:
        circles = geo.grid_circles()
        print(f"discovery: {len(circles)} circles of {config.GRID_RADIUS_M} m")
        found = discover(places, circles)
        outside = wrong_type = junk = 0
        kept = []
        for pid, p in found.items():
            loc = p.get("location") or {}
            if not geo.neighborhood_for(loc.get("latitude", 0), loc.get("longitude", 0)):
                outside += 1
            elif p.get("primaryType") not in CAFE_PRIMARY_TYPES:
                wrong_type += 1
            elif is_unclear_name((p.get("displayName") or {}).get("text"), p.get("formattedAddress")):
                junk += 1
            else:
                kept.append(((p.get("displayName") or {}).get("text", ""), pid))
        targets = [(None, pid) for _, pid in sorted(kept)]
        print(f"discovery: {len(found)} unique places; {outside} outside NTAs, {wrong_type} wrong primaryType, "
              f"{junk} unclear names, {len(targets)} kept")
    if args.limit is not None:
        targets = targets[: args.limit]

    mode = f"WRITE to {urlparse(env['NEXT_PUBLIC_SUPABASE_URL']).hostname}" if args.write else "DRY RUN (no writes)"
    print(f"\n=== {mode}: {len(targets)} cafe(s) ===")
    run_id = store.start_run() if args.write else None
    processed = 0
    done: list[tuple[dict, dict]] = []  # (row, meta) for the summary table
    for i, (query, pid) in enumerate(targets, 1):
        try:
            row, analysis, meta = process(pid, places, client, stats, existing, taken, args.with_websites)
            report(i, len(targets), query, row, analysis, meta)
            if args.write:
                cafe_id = store.upsert_cafe(row)
                store.upsert_prices(cafe_id, analysis.prices)
                existing[pid] = {"slug": meta["slug"], "hidden_reason": row.get("hidden_reason", existing.get(pid, {}).get("hidden_reason"))}
            processed += 1
            done.append((row, meta))
        except OutOfScope as e:
            errors.append(f"skipped: {e}")
            print(f"\n[{i}/{len(targets)}] SKIPPED {e}")
        except Exception as e:  # keep going; record per-cafe failure
            msg = f"{query or pid}: {type(e).__name__}: {str(e)[:300]}"
            errors.append(msg)
            print(f"\n[{i}/{len(targets)}] ERROR {msg}")
    if run_id:
        store.finish_run(run_id, processed, errors)
        refresh_site(errors)

    if done:
        print("\n--- summary ---")
        print(f"{'name':<34} {'address':<26} {'primaryType':<12} {'neighborhood':<18} review")
        for row, meta in sorted(done, key=lambda d: d[0]["name"]):
            addr = (row["address"] or "").split(",")[0]
            print(f"{row['name'][:34]:<34} {addr[:26]:<26} {str(meta['primary_type']):<12} "
                  f"{row['neighborhood']:<18} {', '.join(meta['lookalike'])}")
        flagged = sum(1 for _, m in done if m["lookalike"])
        print(f"flagged for review: {flagged}/{len(done)}")
        hidden = [(r, m) for r, m in done if m["visibility"] != "shown"]
        print(f"\n--- hidden ({len(hidden)}) ---")
        for r, m in sorted(hidden, key=lambda d: d[0]["name"]):
            print(f"{r['name'][:34]:<34} {str(r['street_address'])[:26]:<26} {m['visibility']}")

    print("\n--- totals ---")
    hoods: dict[str, int] = {}
    for row, _ in done:
        hoods[row["neighborhood"]] = hoods.get(row["neighborhood"], 0) + 1
    print("by neighborhood: " + (", ".join(f"{k}={v}" for k, v in sorted(hoods.items())) or "none"))
    print(f"cafes processed: {processed}/{len(targets)}  errors: {len(errors)}")
    print(f"Google calls:    {stats.google_total}  ({', '.join(f'{k}={v}' for k, v in sorted(stats.google.items()))})")
    print(f"Anthropic calls: {stats.anthropic_calls}  (in={stats.input_tokens:,} tok, out={stats.output_tokens:,} tok)")
    print(f"Website fetches: {stats.web_fetches}")
    if not args.write:
        print("dry run: nothing written to Supabase")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
