import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from address import street_line
from classify import auto_hide_reason
from haiku import check_summary, copies_review


def comp(*pairs):
    return [{"types": [t], "shortText": v} for t, v in pairs]


def test_street_line():
    assert street_line(comp(("street_number", "204"), ("route", "W 10th St"), ("locality", "New York"))) == "204 W 10th St"
    assert street_line(comp(("route", "Bleecker St"))) == "Bleecker St"
    assert street_line(comp(("premise", "East Store"), ("locality", "New York"))) is None
    assert street_line(None) is None


def test_auto_hide_name_and_type():
    assert auto_hide_reason("NYU Cafe (Access Required)", "cafe", []) == "auto: name says access required"
    assert auto_hide_reason("X", "italian_restaurant", []) == "auto: primaryType italian_restaurant"
    assert auto_hide_reason("X", "wine_bar", []) == "auto: primaryType wine_bar"
    assert auto_hide_reason("X", "coffee_shop", [None, "Cozy cafe with pastries."]) is None


def test_auto_hide_takeout_only():
    assert auto_hide_reason("X", "cafe", ["Takeout-only coffee counter."]) == "auto: summary says takeout-only"
    assert auto_hide_reason("X", "cafe", ["Tiny spot with no seating, just espresso."]) == "auto: summary says takeout-only"
    # grab-and-go food at a sit-down cafe is not takeout-only
    assert auto_hide_reason("X", "cafe", ["Coffee shop with baked goods and grab-and-go bites."]) is None


def test_check_summary():
    reviews = ["The staff were lovely and the cortado was the best I have had in the city"]
    assert check_summary("", reviews) == (None, None)
    assert check_summary("Cozy spot, and the restroom is clean.", reviews)[0] is None
    assert check_summary("Dog friendly corner cafe.", reviews)[0] is None
    assert check_summary("Friendly staff and a cortado that regulars rave about.", reviews) == (
        "Friendly staff and a cortado that regulars rave about.", None)
    assert copies_review("they said the cortado was the best I have had", reviews)
