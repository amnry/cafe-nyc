import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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
    assert geo.neighborhood_for(40.7580, -73.9855) is None                  # Times Square


def test_grid_covers_scope_and_is_sane():
    import math
    circles = geo.grid_circles()
    assert 10 < len(circles) < 120
    for lat, lng in [(40.7340, -74.0052), (40.7300, -74.0003), (40.7350, -74.0050)]:
        assert geo.neighborhood_for(lat, lng)
        assert any(math.hypot((lat - c[0]) * 111320, (lng - c[1]) * 111320 * math.cos(math.radians(lat))) <= c[2]
                   for c in circles)


def test_split_circle():
    parts = geo.split_circle(40.73, -74.0, 250)
    assert len(parts) == 4 and all(p[2] == 125 for p in parts)
