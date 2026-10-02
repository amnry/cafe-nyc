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
    assert geo.neighborhood_for(40.7736, -73.9566) is None                  # Upper East Side


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
    assert not geo.touches_scope(40.7850, -73.9700, 300)       # Central Park, far from scope
