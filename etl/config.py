import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Official NYC Open Data 2020 NTA boundaries (dataset 9nt8-h7nd). A cafe's neighborhood is the
# short label of whichever target NTA contains it. Labels are what cafes.neighborhood stores and
# the site shows; West Village / Greenwich Village keep their v1 strings so existing rows are unchanged.
# Regenerate the data file with scripts/fetch_ntas.py after editing this map.
TARGET_NTAS = {
    # Manhattan south of 59th St (MN0191 Battery/islands and MN0661 UN excluded)
    "MN0101": "FiDi",
    "MN0102": "Tribeca",
    "MN0201": "SoHo",
    "MN0202": "Greenwich Village",
    "MN0203": "West Village",
    "MN0301": "Chinatown",
    "MN0302": "Lower East Side",
    "MN0303": "East Village",
    "MN0401": "Chelsea",
    "MN0402": "Hell's Kitchen",
    "MN0501": "Flatiron",
    "MN0502": "Midtown",
    "MN0601": "Stuy Town",
    "MN0602": "Gramercy",
    "MN0603": "Murray Hill",
    "MN0604": "Turtle Bay",
    # Upper Manhattan: several NTAs share one label so the picker shows the familiar neighborhood.
    # (Roosevelt Island has no NTA of its own; it sits inside MN0801.)
    "MN0701": "Upper West Side",
    "MN0702": "Upper West Side",
    "MN0703": "Upper West Side",
    "MN0801": "Upper East Side",
    "MN0802": "Upper East Side",
    "MN0803": "Upper East Side",
    "MN0901": "Morningside Heights",
    "MN0902": "Manhattanville",
    "MN0903": "Hamilton Heights",
    "MN1001": "Harlem",
    "MN1002": "Harlem",
    "MN1101": "East Harlem",
    "MN1102": "East Harlem",
    "MN1201": "Washington Heights",
    "MN1202": "Washington Heights",
    "MN1203": "Inwood",
    # Brooklyn / Queens
    "BK0101": "Greenpoint",
    "BK0102": "Williamsburg",
    "BK0201": "Brooklyn Heights",
    "BK0202": "DUMBO",
    "QN0201": "Long Island City",
}

# NTAs that scheduled runs, and manual runs without --neighborhoods, cover: all of Manhattan from the
# southern tip to Inwood (excluding parks, Randall's and the islands). Stage 2 adds the 5 Brooklyn/Queens codes.
ACTIVE_NTAS = frozenset(code for code in TARGET_NTAS if code.startswith("MN"))


def resolve_ntas(tokens: list[str]) -> frozenset[str]:
    """Map NTA codes or short labels (case-insensitive) to codes; a label shared by several NTAs
    (e.g. "Harlem") gives all of them. Unknown tokens raise ValueError."""
    by_name: dict[str, set[str]] = {}
    for code, label in TARGET_NTAS.items():
        by_name.setdefault(code.lower(), set()).add(code)
        by_name.setdefault(label.lower(), set()).add(code)
    codes, unknown = set(), []
    for t in tokens:
        t = t.strip()
        if not t:
            continue
        if t.lower() in by_name:
            codes |= by_name[t.lower()]
        else:
            unknown.append(t)
    if unknown:
        raise ValueError(f"unknown neighborhood(s): {', '.join(unknown)}. Use NTA codes or labels from config.TARGET_NTAS")
    if not codes:
        raise ValueError("no neighborhoods given")
    return frozenset(codes)


NTA_FILE = Path(__file__).resolve().parent / "data" / "nta_targets.geojson"

HAIKU_MODEL = "claude-haiku-4-5-20251001"

# Must match the check constraint on cafes.ai_summary_source.
SUMMARY_GENERATIVE = "generative"
SUMMARY_EDITORIAL = "editorial"
SUMMARY_HAIKU = "haiku"

MENU_ITEMS = ("latte", "americano", "cappuccino", "matcha", "drip")

# Discovery keeps a place only if its Google primaryType is one of these (not merely
# listed among its types), so restaurants/bars that also tag "cafe" are excluded. Chains are kept.
CAFE_PRIMARY_TYPES = ("cafe", "coffee_shop")

GRID_RADIUS_M = 250  # coarse grid; circles that hit the cap are subdivided
MIN_RADIUS_M = 50  # subdivision floor; a circle this small still at the cap is logged
NEARBY_MAX_RESULTS = 20  # Places Nearby Search hard cap per call

# Abort a run once it has made this many Google HTTP requests (retries included).
# Set from the reviewed expansion estimate (21 NTAs, ~1.5x the estimator's mid calls per refresh).
MAX_GOOGLE_CALLS = 1200

# Google Maps Platform list prices, 0-100k tier, USD per 1,000 billable events, with the free
# events per SKU per calendar month. Checked 2026-10-01 at
# developers.google.com/maps/billing-and-pricing/pricing. Used by estimate.py only.
PRICING_CHECKED = "2026-10-01"
PRICING = {
    # Any of restroom/allowsDogs/outdoorSeating/reservable/servesWine/generativeSummary/
    # editorialSummary in the field mask puts the call in the Enterprise + Atmosphere SKU.
    "nearby_search": {"sku": "Nearby Search Enterprise + Atmosphere", "per_1000": 40.0, "free": 1000},
    "place_details": {"sku": "Place Details Enterprise + Atmosphere", "per_1000": 25.0, "free": 1000},
}


def load_env() -> None:
    """Load ROOT/.env.local into os.environ without overriding real env vars."""
    path = ROOT / ".env.local"
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def require_env(*names: str) -> dict[str, str]:
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        raise SystemExit(f"missing env vars: {', '.join(missing)}")
    return {n: os.environ[n] for n in names}
