import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Official NYC Open Data 2020 NTA boundaries (dataset 9nt8-h7nd): Greenwich Village
# (MN0202) and West Village (MN0203). A cafe's neighborhood is whichever contains it.
NTA_FILE = Path(__file__).resolve().parent / "data" / "nta_west_greenwich_village.geojson"

HAIKU_MODEL = "claude-haiku-4-5-20251001"

# Must match the check constraint on cafes.ai_summary_source.
SUMMARY_GENERATIVE = "generative"
SUMMARY_EDITORIAL = "editorial"
SUMMARY_HAIKU = "haiku"

MENU_ITEMS = ("latte", "americano", "cappuccino", "matcha", "drip")

# Discovery keeps a place only if its Google primaryType is one of these (not merely
# listed among its types), so restaurants/bars that also tag "cafe" are excluded. Chains are kept.
CAFE_PRIMARY_TYPES = ("cafe", "coffee_shop")

GRID_RADIUS_M = 250
NEARBY_MAX_RESULTS = 20  # Places Nearby Search hard cap per call


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
