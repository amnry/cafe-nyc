"""Write etl/data/nta_targets.geojson from NYC Open Data 2020 NTA boundaries (dataset 9nt8-h7nd).

  python scripts/fetch_ntas.py

Free, no API key. Keeps only config.TARGET_NTAS, with properties nta2020, ntaname (official)
and label (what the site shows).
"""
import json
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import NTA_FILE, TARGET_NTAS

URL = "https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson"


def main() -> int:
    codes = ",".join(f"'{c}'" for c in sorted(TARGET_NTAS))
    r = requests.get(URL, params={"$where": f"nta2020 in ({codes})", "$limit": 100}, timeout=60)
    r.raise_for_status()
    features = []
    for f in sorted(r.json()["features"], key=lambda f: f["properties"]["nta2020"]):
        code = f["properties"]["nta2020"]
        features.append({
            "type": "Feature",
            "properties": {"nta2020": code, "ntaname": f["properties"]["ntaname"], "label": TARGET_NTAS[code]},
            "geometry": f["geometry"],
        })
    missing = set(TARGET_NTAS) - {f["properties"]["nta2020"] for f in features}
    if missing:
        raise SystemExit(f"not found in dataset: {', '.join(sorted(missing))}")
    NTA_FILE.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")) + "\n")
    print(f"wrote {len(features)} NTAs to {NTA_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
