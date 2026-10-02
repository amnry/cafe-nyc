import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

import config
import geo
import run
from places import Discovery

WV = (40.7340, -74.0052)      # West Village (MN0203)
WBURG = (40.7143, -73.9614)   # Williamsburg (BK0102)


@pytest.fixture(autouse=True)
def reset_scope():
    geo.set_scope(None)
    yield
    geo.set_scope(None)


def test_active_ntas_is_every_manhattan_target():
    assert len(config.ACTIVE_NTAS) == 32  # 16 below 59th St + 16 upper Manhattan
    assert all(c.startswith("MN") and c in config.TARGET_NTAS for c in config.ACTIVE_NTAS)
    assert config.ACTIVE_NTAS == {c for c in config.TARGET_NTAS if c.startswith("MN")}
    assert not any(c.startswith(("BK", "QN")) for c in config.ACTIVE_NTAS)  # Stage 2


def test_shared_label_resolves_to_every_nta():
    assert config.resolve_ntas(["harlem"]) == {"MN1001", "MN1002"}
    assert config.resolve_ntas(["Upper West Side", "Inwood"]) == {"MN0701", "MN0702", "MN0703", "MN1203"}


def test_resolve_ntas_accepts_codes_and_labels_case_insensitive():
    assert config.resolve_ntas(["MN0203", " west village ", "bk0102"]) == {"MN0203", "BK0102"}
    with pytest.raises(ValueError, match="Nowhere"):
        config.resolve_ntas(["MN0203", "Nowhere"])
    with pytest.raises(ValueError):
        config.resolve_ntas([" "])


def test_scope_limits_labels_lookup_and_circles():
    all_circles = geo.grid_circles()
    geo.set_scope({"MN0203"})
    assert geo.labels() == ["West Village"]
    assert geo.neighborhood_for(*WV) == "West Village"
    assert geo.neighborhood_for(*WBURG) is None
    scoped = geo.grid_circles()
    assert 0 < len(scoped) < len(all_circles)
    assert all(geo.touches_scope(a, b, r) for a, b, r in scoped)
    geo.set_scope(None)
    assert len(geo.labels()) == len(config.TARGET_NTAS)


def test_manhattan_scope_has_no_brooklyn_or_queens_circles():
    geo.set_scope(config.ACTIVE_NTAS)
    circles = geo.grid_circles()
    assert set(geo.labels()) == {config.TARGET_NTAS[c] for c in config.ACTIVE_NTAS}
    assert circles and all(geo.touches_scope(*c) for c in circles)
    # Edge circles may be centered just across the river; they still reach Manhattan, and any outer-borough
    # cafe they return is dropped by neighborhood_for (see test_discovery_targets_respects_scope).
    assert geo.neighborhood_for(*WBURG) is None


def test_set_scope_rejects_unknown_code():
    with pytest.raises(ValueError):
        geo.set_scope({"XX9999"})


def _place(pid, loc):
    return {"id": pid, "displayName": {"text": pid.title()}, "primaryType": "cafe",
            "formattedAddress": "1 Main St", "location": {"latitude": loc[0], "longitude": loc[1]}}


def test_discovery_targets_respects_scope(monkeypatch):
    """A Brooklyn cafe the search returns is dropped, and a stored Brooklyn cafe is not re-checked
    with Place Details, when the scope is Manhattan only."""
    found = {"mn1": _place("mn1", WV), "bk1": _place("bk1", WBURG)}
    seen = {}

    def fake_discover(places, circles):
        seen["circles"] = circles
        return Discovery(places=dict(found))

    monkeypatch.setattr(run, "discover", fake_discover)
    existing = {"mn_gone": {"slug": "a", "neighborhood": "West Village", "hidden_reason": None},
                "bk_gone": {"slug": "b", "neighborhood": "Williamsburg", "hidden_reason": None}}

    geo.set_scope(config.ACTIVE_NTAS)
    targets, prefetched = run.discovery_targets(object(), existing, [])
    assert set(targets) == {"mn1", "mn_gone"}
    assert "bk_gone" not in targets
    assert seen["circles"] and not any(geo.neighborhood_for(a, b) == "Williamsburg" for a, b, _ in seen["circles"])

    geo.set_scope({"BK0102"})
    targets, _ = run.discovery_targets(object(), existing, [])
    assert set(targets) == {"bk1", "bk_gone"}


def test_main_scope_defaults_and_flag(monkeypatch):
    """--neighborhoods sets the scope; without it ACTIVE_NTAS is used. Stops at env check."""
    def run_main(argv):
        monkeypatch.setattr(sys, "argv", ["run.py", *argv])
        monkeypatch.setattr(config, "load_env", lambda: None)
        monkeypatch.setattr(config, "require_env", lambda *k: (_ for _ in ()).throw(SystemExit("stop")))
        with pytest.raises(SystemExit):
            run.main()
        return set(geo._scope)

    assert run_main([]) == set(config.ACTIVE_NTAS)
    assert run_main(["--neighborhoods", "MN0203,Williamsburg"]) == {"MN0203", "BK0102"}
    monkeypatch.setattr(sys, "argv", ["run.py", "--neighborhoods", "Atlantis"])
    with pytest.raises(SystemExit) as e:
        run.main()
    assert e.value.code == 2
