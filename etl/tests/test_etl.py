import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import math
import random

import pytest

import geo
from slug import build_slug, street_parts


def test_street_parts():
    assert street_parts("141 Waverly Pl, New York, NY 10014, USA") == ("141", "Waverly Pl")
    assert street_parts("Christopher St, New York") == ("", "Christopher St")
    assert street_parts(None) == ("", "")


def test_slug_name_plus_street():
    assert build_slug("Joe Coffee", "141 Waverly Pl, New York, NY", "ChIJabc12345", set()) == "joe-coffee-waverly-pl"


def test_slug_collision_fallbacks():
    addr = "141 Waverly Pl, New York, NY"
    taken = {"joe-coffee-waverly-pl"}
    s = build_slug("Joe Coffee", addr, "ChIJabc12345", taken)
    assert s == "joe-coffee-waverly-pl-141"
    taken.add(s)
    assert build_slug("Joe Coffee", addr, "ChIJabc12345", taken) == "joe-coffee-waverly-pl-chijabc1"


def test_slug_no_address_uses_place_id():
    assert build_slug("Café Reggio", None, "ChIJabc12345", set()) == "cafe-reggio-chijabc1"


def test_slug_matches_db_format():
    import re
    s = build_slug("Bedford Studio!", "1 Bedford St, NY", "x", set())
    assert re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", s)


def test_neighborhood_tagging_uses_nta_boundaries():
    assert geo.neighborhood_for(40.7340, -74.0052) == "West Village"        # 204 W 10th St area
    assert geo.neighborhood_for(40.7300, -74.0003) == "Greenwich Village"   # MacDougal St area
    assert geo.neighborhood_for(40.7143, -73.9614) == "Williamsburg"        # Bedford Ave
    assert geo.neighborhood_for(40.7447, -73.9485) == "Long Island City"    # Vernon Blvd
    assert geo.neighborhood_for(40.7712, -73.9742) is None                  # Central Park
    assert geo.neighborhood_for(40.7736, -73.9566) == "Upper East Side"     # Lexington Ave, 70s
    assert geo.neighborhood_for(40.8116, -73.9465) == "Harlem"              # Lenox Ave, 125th
    assert geo.neighborhood_for(40.8417, -73.9394) == "Washington Heights"  # Broadway, 181st
    assert geo.neighborhood_for(40.8800, -73.8800) is None                  # the Bronx


def test_grid_covers_scope_and_is_sane():
    import math
    circles = geo.grid_circles()
    assert 200 < len(circles) < 800
    for lat, lng in [(40.7340, -74.0052), (40.7300, -74.0003), (40.7350, -74.0050),
                     (40.7143, -73.9614), (40.7447, -73.9485), (40.7033, -73.9881), (40.7075, -74.0113)]:
        assert geo.neighborhood_for(lat, lng)
        assert any(math.hypot((lat - c[0]) * 111320, (lng - c[1]) * 111320 * math.cos(math.radians(lat))) <= c[2]
                   for c in circles)


def _dist_m(a, b):
    return math.hypot((a[0] - b[0]) * 111320, (a[1] - b[1]) * 111320 * math.cos(math.radians(a[0])))


def test_split_circle_covers_parent():
    lat, lng, r = 40.73, -74.0, 250
    parts = geo.split_circle(lat, lng, r)
    assert len(parts) == 4 and all(abs(p[2] - r / math.sqrt(2)) < 1e-9 for p in parts)
    rng = random.Random(1)
    for _ in range(1000):
        ang, rad = rng.uniform(0, 2 * math.pi), r * math.sqrt(rng.random())
        pt = geo.offset(lat, lng, rad * math.cos(ang), rad * math.sin(ang))
        assert any(_dist_m(pt, p) <= p[2] + 1e-6 for p in parts), pt
    # the old half-radius split missed points like this one, on an axis near the edge
    edge = geo.offset(lat, lng, 0, 0.95 * r)
    assert any(_dist_m(edge, p) <= p[2] for p in parts)


def test_touches_scope():
    assert geo.touches_scope(40.7340, -74.0052, 10)            # center inside West Village
    # Hudson River, ~300 m west of the West Village shoreline: only a big circle reaches land
    assert not geo.touches_scope(40.7340, -74.0150, 100)
    assert geo.touches_scope(40.7340, -74.0150, 600)
    assert not geo.touches_scope(40.8800, -73.8800, 300)       # the Bronx, far from scope


# --- --if-stale-days (schedule B) ---
from datetime import datetime, timedelta, timezone  # noqa: E402

import config  # noqa: E402
import run as run_mod  # noqa: E402

_NOW = datetime(2026, 11, 2, 9, 0, tzinfo=timezone.utc)
_FULL = run_mod.scope_marker(config.ACTIVE_NTAS)


def _run_row(days_ago, processed=100, errors=(), scope=_FULL):
    return {"finished_at": (_NOW - timedelta(days=days_ago)).isoformat(), "cafes_processed": processed,
            "errors": list(errors) + ([scope] if scope else [])}


def test_due_when_no_runs():
    assert run_mod.is_due([], 23, _NOW)


def test_not_due_under_23_days_due_at_23():
    assert not run_mod.is_due([_run_row(22.9)], 23, _NOW)
    assert run_mod.is_due([_run_row(23)], 23, _NOW)


def test_aborted_and_empty_runs_do_not_count_but_skipped_does():
    runs = [_run_row(1, errors=["aborted: call budget"]), _run_row(2, processed=0), _run_row(3, errors=["skipped: out of scope", "warning: x"])]
    assert run_mod.last_success(runs) == _NOW - timedelta(days=3)
    assert not run_mod.is_due(runs, 23, _NOW)
    assert run_mod.is_due(runs[:2], 23, _NOW)  # only failed runs: due


def test_scoped_run_does_not_reset_the_clock():
    """A --neighborhoods run covering part of ACTIVE_NTAS, however recent, is ignored."""
    partial = _run_row(1, scope=run_mod.scope_marker(sorted(config.ACTIVE_NTAS)[:3]))
    old_full = _run_row(30)
    assert run_mod.last_success([partial, old_full]) == _NOW - timedelta(days=30)
    assert run_mod.is_due([partial, old_full], 23, _NOW)
    assert run_mod.is_due([partial], 23, _NOW)  # nothing qualifying at all


def test_runs_without_a_scope_marker_do_not_count():
    """Older rows, --limit, --names and --place-ids runs record no scope."""
    assert run_mod.is_due([_run_row(1, scope=None)], 23, _NOW)


def test_superset_scope_counts_and_expanding_active_ntas_invalidates_old_runs():
    everything = _run_row(2, scope=run_mod.scope_marker(config.TARGET_NTAS))
    assert not run_mod.is_due([everything], 23, _NOW)  # covers ACTIVE_NTAS and more
    manhattan_only = _run_row(2)
    assert not run_mod.is_due([manhattan_only], 23, _NOW)
    stage2 = set(config.ACTIVE_NTAS) | {"BK0101", "BK0102", "BK0201", "BK0202", "QN0201"}
    assert run_mod.is_due([manhattan_only], 23, _NOW, required=stage2)  # Stage 2 forces a refresh
    assert not run_mod.is_due([everything], 23, _NOW, required=stage2)


# --- Store.existing pages past PostgREST's 1000-row cap ---
def test_existing_pages_past_the_1000_row_cap(monkeypatch):
    import store as store_mod

    total = 1343
    offsets = []

    class Resp:
        ok = True

        def __init__(self, rows):
            self._rows = rows

        def json(self):
            return self._rows

    def fake_get(url, params, headers, timeout):
        off, lim = int(params["offset"]), int(params["limit"])
        offsets.append(off)
        n = min(lim, total - off)
        return Resp([{"google_place_id": f"p{off + i}", "slug": "s", "neighborhood": "SoHo", "hidden_reason": None}
                     for i in range(n)])

    monkeypatch.setattr(store_mod.requests, "get", fake_get)
    got = store_mod.Store("https://x.supabase.co", "key").existing()
    assert len(got) == total and offsets == [0, 1000]


def test_refresh_site_posts_to_www_with_bearer(monkeypatch):
    seen = {}

    class Resp:
        ok, status_code = True, 200

    monkeypatch.setenv("REVALIDATE_SECRET", "s3cret")
    monkeypatch.delenv("SITE_URL", raising=False)
    monkeypatch.setattr(run_mod.requests, "post", lambda url, headers, timeout: seen.update(url=url, h=headers) or Resp())
    errors = []
    run_mod.refresh_site(errors)
    assert seen["url"] == "https://www.3rdplacenyc.com/api/revalidate" and seen["h"]["Authorization"] == "Bearer s3cret"
    assert errors == []
