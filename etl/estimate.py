"""Cost and coverage estimate for a discovery run. Makes NO Google or Anthropic calls.

  python estimate.py [--out estimate.json] [--churn 0.03]

Free inputs only:
  - NYC DOHMH restaurant inspections (Open Data 43nn-pn8j), cuisine "Coffee/Tea", as a proxy
    for where cafes are.
  - Our own Supabase cafes table (service role read), to calibrate the proxy against what
    Google actually returned in West Village + Greenwich Village.

The proxy points are fed through the real geo.grid_circles / places.discover code, with a
fake Places object that answers each Nearby Search with k x (proxy points in the circle),
capped at 20. So the circle and call counts come from the same subdivision logic the paid
run uses.
"""
import argparse
import json
import math
import os
import sys
from collections import Counter
from datetime import date, timedelta

import requests

import config
import geo
from config import NEARBY_MAX_RESULTS, PRICING, PRICING_CHECKED
from places import discover
from store import Store

DOHMH_URL = "https://data.cityofnewyork.us/resource/43nn-pn8j.json"
V1_HOODS = ("West Village", "Greenwich Village")
RADII = (150, 200, 250, 300, 350, 400, 600, 800)
BAND = {"low": 0.7, "mid": 1.0, "high": 1.3}
STALE_DAYS = 23  # schedule B: weekly check, refresh when the last good run is this old
M = 111_320.0


def proxy_points() -> list[tuple[float, float]]:
    """Distinct Coffee/Tea establishments with coordinates, inside the target NTAs."""
    r = requests.get(DOHMH_URL, params={
        "$select": "camis,max(latitude) as lat,max(longitude) as lng",
        "$where": "cuisine_description='Coffee/Tea' AND latitude IS NOT NULL AND latitude != 0",
        "$group": "camis", "$limit": 50000,
    }, timeout=120)
    r.raise_for_status()
    pts = []
    for row in r.json():
        lat, lng = float(row["lat"]), float(row["lng"])
        if geo.neighborhood_for(lat, lng):
            pts.append((lat, lng))
    return pts


class ProxyPlaces:
    """Stands in for places.Places: a Nearby Search returns k x (proxy points in circle), max 20."""

    def __init__(self, points, k: float):
        self.points = points
        self.k = k

    def nearby(self, lat, lng, r):
        kx = M * math.cos(math.radians(lat))
        n = sum(1 for a, b in self.points if math.hypot((a - lat) * M, (b - lng) * kx) <= r)
        m = min(NEARBY_MAX_RESULTS, round(self.k * n))
        return [{"id": f"{lat:.6f},{lng:.6f},{r:.1f},{i}"} for i in range(m)]


def simulate(points, k: float, radius: float) -> dict:
    circles = geo.grid_circles(radius)
    d = discover(ProxyPlaces(points, k), circles)
    return {"coarse_circles": len(circles), "calls": sum(d.calls_by_depth.values()),
            "calls_by_depth": dict(sorted(d.calls_by_depth.items())), "saturated_leaves": len(d.saturated_leaves)}


def sku_cost(sku: str, calls_in_month: float) -> float:
    p = PRICING[sku]
    return max(0.0, calls_in_month - p["free"]) * p["per_1000"] / 1000


def month_cost(runs: int, nearby: int, details: int) -> float:
    return sku_cost("nearby_search", runs * nearby) + sku_cost("place_details", runs * details)


def schedule_b_runs(start: date, months: int = 12) -> Counter:
    """Runs per calendar month over the next `months`, with a weekly check that refreshes once the
    last successful run is STALE_DAYS old. With weekly checks that is every 28 days."""
    interval = math.ceil(STALE_DAYS / 7) * 7
    end = date(start.year + (start.month - 1 + months) // 12, (start.month - 1 + months) % 12 + 1, 1)
    runs: Counter = Counter()
    d = start
    while d < end:
        runs[(d.year, d.month)] += 1
        d += timedelta(days=interval)
    return runs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", help="also write the full result as JSON here")
    ap.add_argument("--churn", type=float, default=0.03,
                    help="share of stored cafes a refresh does not find by search (closed, moved), default 0.03")
    args = ap.parse_args()

    config.load_env()
    # Paid-API keys are dropped before anything runs, so no code path here can spend money.
    for key in ("GOOGLE_PLACES_API_KEY", "ANTHROPIC_API_KEY"):
        os.environ.pop(key, None)
    env = config.require_env("SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL")
    existing = Store(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]).existing()

    points = proxy_points()
    by_hood = Counter(geo.neighborhood_for(a, b) for a, b in points)

    # Calibration on v1: stored cafes (hidden included: Google returns them too) per proxy point.
    v1 = [e for e in existing.values() if e["neighborhood"] in V1_HOODS]
    v1_proxy = sum(by_hood[h] for h in V1_HOODS)
    if not v1 or not v1_proxy:
        raise SystemExit("no v1 cafes or proxy points to calibrate against")
    k = len(v1) / v1_proxy
    hidden_share = sum(1 for e in v1 if e["hidden_reason"]) / len(v1)
    # Stored cafes hidden for a non-cafe primaryType are filtered out of Nearby Search by
    # includedPrimaryTypes, so every refresh re-checks them with Place Details.
    type_hidden_share = sum(1 for e in v1 if (e["hidden_reason"] or "").startswith("auto: primaryType")) / len(v1)

    sweep = {r: simulate(points, k, r) for r in RADII}
    best = min(RADII, key=lambda r: sweep[r]["calls"])
    sims = {band: simulate(points, k * f, best) for band, f in BAND.items()}

    out = {"pricing_checked": PRICING_CHECKED, "pricing": PRICING, "proxy_points": len(points),
           "calibration": {"v1_stored": len(v1), "v1_proxy": v1_proxy, "k": round(k, 3),
                           "hidden_share": round(hidden_share, 3), "type_hidden_share": round(type_hidden_share, 3)},
           "radius_sweep_mid": sweep, "chosen_radius_m": best, "bands": {}}

    today = date.today()
    b_runs = schedule_b_runs(today)
    for band, f in BAND.items():
        cafes = {h: round(n * k * f) for h, n in sorted(by_hood.items())}
        total = sum(cafes.values())
        nearby = sims[band]["calls"]
        details = round(total * (args.churn + type_hidden_share))
        per_month_b = {f"{y}-{m:02d}": round(month_cost(n, nearby, details), 2) for (y, m), n in sorted(b_runs.items())}
        out["bands"][band] = {
            **sims[band], "cafes_total": total, "cafes_visible": round(total * (1 - hidden_share)),
            "cafes_by_neighborhood": cafes,
            "per_refresh": {"nearby_search_calls": nearby, "place_details_calls": details,
                            "google_calls": nearby + details},
            "schedule_a_monthly_usd": round(month_cost(2, nearby, details), 2),
            "schedule_a_12mo_usd": round(12 * month_cost(2, nearby, details), 2),
            "schedule_b_one_run_month_usd": round(month_cost(1, nearby, details), 2),
            "schedule_b_two_run_month_usd": round(month_cost(2, nearby, details), 2),
            "schedule_b_12mo_usd": round(sum(per_month_b.values()), 2),
            "schedule_b_by_month_usd": per_month_b,
        }
    mid = out["bands"]["mid"]["per_refresh"]["google_calls"]
    out["suggested_max_calls"] = math.ceil(1.5 * mid)
    out["schedule_b_runs_per_month_avg"] = round(sum(b_runs.values()) / 12, 2)
    report(out)
    if args.out:
        with open(args.out, "w") as fh:
            json.dump(out, fh, indent=2)
        print(f"\nwrote {args.out}")
    return 0


def report(o: dict) -> None:
    c = o["calibration"]
    print(f"Pricing checked {o['pricing_checked']}: "
          + "; ".join(f"{p['sku']} ${p['per_1000']:.0f}/1k, {p['free']:,} free/mo" for p in o["pricing"].values()))
    print(f"Proxy: {o['proxy_points']} DOHMH Coffee/Tea points in scope. Calibration on WV+GV: "
          f"{c['v1_stored']} stored cafes / {c['v1_proxy']} proxy points = k {c['k']}; "
          f"hidden {c['hidden_share']:.0%}, hidden for primaryType {c['type_hidden_share']:.0%}")
    print("\nCoarse radius sweep (mid k):")
    print(f"  {'radius':>6} {'coarse':>7} {'calls':>6} {'saturated@floor':>16}  calls by depth")
    for r, s in o["radius_sweep_mid"].items():
        mark = "  <- chosen" if r == o["chosen_radius_m"] else ""
        print(f"  {r:>5}m {s['coarse_circles']:>7} {s['calls']:>6} {s['saturated_leaves']:>16}  {s['calls_by_depth']}{mark}")
    b = o["bands"]
    cols = ("low", "mid", "high")
    print(f"\nPer refresh at {o['chosen_radius_m']} m          " + "".join(f"{x:>10}" for x in cols))
    rows = [
        ("coarse circles", lambda x: x["coarse_circles"]),
        ("Nearby Search E+A calls", lambda x: x["per_refresh"]["nearby_search_calls"]),
        ("Place Details E+A calls", lambda x: x["per_refresh"]["place_details_calls"]),
        ("saturated leaves @50 m", lambda x: x["saturated_leaves"]),
        ("cafes (incl. hidden)", lambda x: x["cafes_total"]),
        ("cafes shown", lambda x: x["cafes_visible"]),
        ("A: 2/month, $/month", lambda x: f"${x['schedule_a_monthly_usd']:.2f}"),
        ("A: 12 months", lambda x: f"${x['schedule_a_12mo_usd']:.2f}"),
        ("B: 1-run month", lambda x: f"${x['schedule_b_one_run_month_usd']:.2f}"),
        ("B: 2-run month", lambda x: f"${x['schedule_b_two_run_month_usd']:.2f}"),
        ("B: 12 months", lambda x: f"${x['schedule_b_12mo_usd']:.2f}"),
    ]
    for label, fn in rows:
        print(f"  {label:<30}" + "".join(f"{fn(b[x])!s:>10}" for x in cols))
    print(f"  Anthropic: $0 (summary fallback removed)")
    print(f"\nSchedule B runs every 28 days (weekly check, >= {STALE_DAYS} days): "
          f"{o['schedule_b_runs_per_month_avg']} runs/month on average")
    print(f"Suggested --max-calls (1.5 x mid): {o['suggested_max_calls']}")
    print("\nCafes by neighborhood (incl. hidden)      " + "".join(f"{x:>8}" for x in cols))
    for h in b["mid"]["cafes_by_neighborhood"]:
        print(f"  {h:<38}" + "".join(f"{b[x]['cafes_by_neighborhood'][h]:>8}" for x in cols))


if __name__ == "__main__":
    sys.exit(main())
