import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from classify import lookalike_flags


def test_plain_cafe_is_clean():
    assert lookalike_flags("787 Coffee", ["coffee_shop", "cafe", "food", "store"]) == []


def test_espresso_bar_is_not_a_bar():
    assert lookalike_flags("Joe Espresso Bar", ["cafe"]) == []
    assert lookalike_flags("Third Rail Coffee Bar", ["coffee_shop"]) == []


def test_flags_by_type():
    assert lookalike_flags("X", ["cafe", "italian_restaurant"]) == ["restaurant?"]
    assert lookalike_flags("X", ["cafe", "wine_bar"]) == ["bar?"]
    assert lookalike_flags("X", ["bakery", "cafe"]) == ["bakery?"]


def test_flags_by_name():
    assert lookalike_flags("Kung Fu Tea", ["cafe"]) == ["bubble tea?"]
    assert lookalike_flags("Boba Guys", ["cafe"]) == ["bubble tea?"]
    assert lookalike_flags("Caffe Reggio Wine Lounge", ["cafe"]) == ["bar?"]
    assert lookalike_flags("Mah-Ze-Dahr Bakery", ["cafe"]) == ["bakery?"]
