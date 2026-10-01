"""Heuristic flags for discovered places that may not be cafes, for human review."""
import re

BAR_TYPES = {"bar", "wine_bar", "pub", "cocktail_bar", "night_club", "brewery", "sports_bar", "beer_garden"}
BUBBLE_TEA_NAMES = re.compile(
    r"\b(boba|bubble tea|milk tea|gong cha|kung fu tea|tiger sugar|xing fu tang|chatime|vivi|tea ?bar)\b", re.I)
RESTAURANT_NAMES = re.compile(r"\b(restaurant|trattoria|osteria|bistro|pizzeria|ristorante|kitchen|grill|diner|eatery)\b", re.I)
# "Espresso bar" / "coffee bar" are cafes; only a bare "bar"-family word is suspicious.
BAR_NAMES = re.compile(r"(?<!espresso )(?<!coffee )(?<!juice )\b(bar|pub|tavern|saloon|lounge|wine)\b", re.I)
BAKERY_NAMES = re.compile(r"\b(bakery|boulangerie|patisserie|pâtisserie|bakeshop)\b", re.I)


def lookalike_flags(name: str, types: list[str] | None) -> list[str]:
    """Reasons a place might be a restaurant, bar, bakery or bubble tea shop rather than a cafe."""
    ts = set(types or [])
    flags = []
    if any(t == "restaurant" or t.endswith("_restaurant") for t in ts) or RESTAURANT_NAMES.search(name):
        flags.append("restaurant?")
    if ts & BAR_TYPES or BAR_NAMES.search(name):
        flags.append("bar?")
    if "bakery" in ts or BAKERY_NAMES.search(name):
        flags.append("bakery?")
    if "bubble_tea_store" in ts or BUBBLE_TEA_NAMES.search(name):
        flags.append("bubble tea?")
    return flags


def is_junk_name(name: str | None) -> bool:
    """Names with fewer than 2 letters/digits ('.', '-', '') are placeholder listings, not cafes."""
    return len(re.findall(r"[^\W_]", name or "")) < 2
