import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import estimate
import geo

WV = (40.7340, -74.0052)


def test_month_cost_uses_free_cap_per_month():
    assert estimate.month_cost(2, 495, 41) == 0                     # 990 + 82, both under 1,000 free
    assert estimate.month_cost(2, 647, 53) == (1294 - 1000) * 40 / 1000
    assert estimate.month_cost(0, 999, 999) == 0


def test_schedule_b_every_28_days():
    runs = estimate.schedule_b_runs(date(2026, 10, 1))
    assert sum(runs.values()) == 14 and max(runs.values()) == 2 and len(runs) == 12


def test_simulate_on_fixture_without_google(monkeypatch):
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    pts = [geo.offset(*WV, (i % 10) * 30, (i // 10) * 30) for i in range(50)]
    s = estimate.simulate(pts, 1.0, 250)
    assert s["coarse_circles"] > 0 and s["calls"] > s["coarse_circles"]   # the cluster forces a split
    assert s["saturated_leaves"] == 0
