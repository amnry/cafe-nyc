import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

import geo
import run
from places import CallBudgetExceeded, Discovery, Places, discover
from stats import Stats

WV = (40.7340, -74.0052)  # inside West Village


class FakePlaces:
    """Nearby Search over a fixed set of points: returns the (up to) 20 nearest inside the circle."""

    def __init__(self, points):
        self.points = points  # [(id, lat, lng)]
        self.nearby_calls = []
        self.details_calls = []

    def nearby(self, lat, lng, r):
        self.nearby_calls.append((lat, lng, r))
        def d(p):
            return math.hypot((p[1] - lat) * 111320, (p[2] - lng) * 111320 * math.cos(math.radians(lat)))
        inside = sorted((p for p in self.points if d(p) <= r), key=d)[:20]
        return [{"id": pid, "location": {"latitude": a, "longitude": b}} for pid, a, b in inside]

    def details(self, pid):
        self.details_calls.append(pid)
        return {"id": pid}


def test_discover_subdivides_until_found_all():
    # 60 cafes clustered within ~40 m: the coarse circle saturates and must split.
    pts = [(f"p{i}", *geo.offset(*WV, (i % 8) * 5, (i // 8) * 5)) for i in range(60)]
    fake = FakePlaces(pts)
    d = discover(fake, [(*WV, 250)])
    assert set(d.places) == {p[0] for p in pts}
    assert d.calls_by_depth[0] == 1 and d.calls_by_depth[1] >= 1
    assert all(r >= 50 for _, _, r in fake.nearby_calls)


def test_discover_floor_reports_saturated_leaf():
    # 30 cafes on one spot can never be separated: recursion stops at the floor and is reported.
    pts = [(f"p{i}", *WV) for i in range(30)]
    fake = FakePlaces(pts)
    d = discover(fake, [(*WV, 250)], min_radius_m=50)
    assert d.saturated_leaves
    assert all(r / math.sqrt(2) < 50 for _, _, r in d.saturated_leaves)
    assert min(r for _, _, r in fake.nearby_calls) >= 50


def test_discover_no_split_under_cap():
    fake = FakePlaces([(f"p{i}", *WV) for i in range(19)])
    d = discover(fake, [(*WV, 250)])
    assert len(fake.nearby_calls) == 1 and len(d.places) == 19


def test_call_budget_aborts_before_request(monkeypatch):
    stats = Stats()
    places = Places("key", stats, max_calls=2)
    sent = []

    class Resp:
        ok, status_code = True, 200

        def json(self):
            return {"places": []}

    monkeypatch.setattr("places.requests.request", lambda *a, **k: sent.append(1) or Resp())
    places.nearby(*WV, 100)
    places.nearby(*WV, 100)
    with pytest.raises(CallBudgetExceeded):
        places.nearby(*WV, 100)
    assert len(sent) == 2 and stats.google_total == 2


def test_nearby_requests_full_mask_without_reviews(monkeypatch):
    seen = {}

    class Resp:
        ok, status_code = True, 200

        def json(self):
            return {"places": []}

    def fake_request(method, url, headers, json, timeout):
        seen.update(headers=headers, body=json)
        return Resp()

    monkeypatch.setattr("places.requests.request", fake_request)
    Places("key", Stats()).nearby(*WV, 100)
    mask = seen["headers"]["X-Goog-FieldMask"].split(",")
    for f in ("places.restroom", "places.allowsDogs", "places.outdoorSeating", "places.generativeSummary",
              "places.regularOpeningHours", "places.addressComponents", "places.primaryType"):
        assert f in mask
    assert not any("review" in f for f in mask)
    assert seen["body"]["rankPreference"] == "DISTANCE"


def test_discovery_targets_details_only_for_unseen(monkeypatch):
    found = {"new1": {"id": "new1", "displayName": {"text": "New Cafe"}, "primaryType": "cafe",
                      "formattedAddress": "1 Bedford St", "location": {"latitude": WV[0], "longitude": WV[1]}},
             "old1": {"id": "old1", "displayName": {"text": "Old Cafe"}, "primaryType": "cafe",
                      "formattedAddress": "2 Bedford St", "location": {"latitude": WV[0], "longitude": WV[1]}}}

    def fake_discover(places, circles):
        return Discovery(places=dict(found))

    monkeypatch.setattr(run, "discover", fake_discover)
    existing = {"old1": {"slug": "old", "neighborhood": "West Village", "hidden_reason": None},
                "gone1": {"slug": "gone", "neighborhood": "West Village", "hidden_reason": None},
                "far1": {"slug": "far", "neighborhood": "Somewhere Else", "hidden_reason": None}}
    targets, prefetched = run.discovery_targets(object(), existing, [])
    assert set(targets) == {"new1", "old1", "gone1"}       # far1 is out of scope
    assert "gone1" not in prefetched                         # only this one needs Place Details
    assert {"new1", "old1"} <= set(prefetched)


def test_pick_summary_google_only():
    assert run.pick_summary({}) == (None, None)
    assert run.pick_summary({"editorialSummary": {"text": "E"}}) == ("E", "editorial")
    assert run.pick_summary({"editorialSummary": {"text": "E"},
                             "generativeSummary": {"overview": {"text": "G"}}}) == ("G", "generative")
