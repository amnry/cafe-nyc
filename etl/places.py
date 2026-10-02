import math
import time
from collections import Counter
from dataclasses import dataclass, field

import requests

from config import CAFE_PRIMARY_TYPES, MIN_RADIUS_M, NEARBY_MAX_RESULTS
from geo import bounds, split_circle, touches_scope
from stats import Stats

BASE = "https://places.googleapis.com/v1"

# Everything a cafe row needs. No reviews: the ETL never fetches review text. The Atmosphere
# fields (restroom ... editorialSummary) put both Nearby Search and Place Details calls in
# the Enterprise + Atmosphere SKU.
PLACE_FIELDS = [
    "id", "displayName", "formattedAddress", "location", "websiteUri", "googleMapsUri",
    "rating", "userRatingCount", "priceLevel", "businessStatus", "regularOpeningHours",
    "restroom", "allowsDogs", "outdoorSeating", "reservable", "servesWine",
    "generativeSummary", "editorialSummary", "primaryTypeDisplayName", "primaryType", "types",
    "addressComponents",
]
DETAILS_MASK = ",".join(PLACE_FIELDS)
# Discovery returns full places, so a cafe found by search needs no Place Details call.
NEARBY_MASK = ",".join(f"places.{f}" for f in PLACE_FIELDS)
SEARCH_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType"

PRICE_LEVELS = {
    "PRICE_LEVEL_FREE": 0,
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
}


class PlacesError(RuntimeError):
    pass


class CallBudgetExceeded(RuntimeError):
    pass


class Places:
    def __init__(self, api_key: str, stats: Stats, max_calls: int | None = None):
        self._key = api_key
        self._stats = stats
        self._max_calls = max_calls

    def _request(self, kind: str, method: str, url: str, mask: str, body=None) -> dict:
        headers = {"X-Goog-Api-Key": self._key, "X-Goog-FieldMask": mask}
        for attempt in range(3):
            # Every HTTP attempt counts, retries included, so the cap is conservative.
            if self._max_calls is not None and self._stats.google_total >= self._max_calls:
                raise CallBudgetExceeded(f"Google call budget of {self._max_calls} reached")
            self._stats.google[kind] += 1
            r = requests.request(method, url, headers=headers, json=body, timeout=30)
            if r.status_code in (429, 500, 503) and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            break
        if not r.ok:
            # Only the API's error message; never echo bodies that could hold review text.
            try:
                msg = r.json()["error"]["message"]
            except (ValueError, KeyError, TypeError):
                msg = "no error message"
            raise PlacesError(f"{kind} HTTP {r.status_code}: {msg[:300]}")
        return r.json()

    def text_search(self, name: str, limit: int = 5) -> list[dict]:
        south, west, north, east = bounds(margin_m=50)
        body = {
            "textQuery": f"{name} cafe New York",
            "pageSize": limit,
            "locationRestriction": {"rectangle": {
                "low": {"latitude": south, "longitude": west},
                "high": {"latitude": north, "longitude": east},
            }},
        }
        data = self._request("text_search", "POST", f"{BASE}/places:searchText", SEARCH_MASK, body)
        return data.get("places", [])

    def nearby(self, lat: float, lng: float, radius_m: float) -> list[dict]:
        body = {
            # Server-side primary-type filter, so the 20-result cap is spent on actual cafes.
            "includedPrimaryTypes": list(CAFE_PRIMARY_TYPES),
            "maxResultCount": NEARBY_MAX_RESULTS,
            "rankPreference": "DISTANCE",
            "locationRestriction": {"circle": {
                "center": {"latitude": lat, "longitude": lng}, "radius": radius_m,
            }},
        }
        data = self._request("nearby_search", "POST", f"{BASE}/places:searchNearby", NEARBY_MASK, body)
        return data.get("places", [])

    def details(self, place_id: str) -> dict:
        return self._request("place_details", "GET", f"{BASE}/places/{place_id}", DETAILS_MASK)


@dataclass
class Discovery:
    places: dict[str, dict] = field(default_factory=dict)  # place id -> full place
    calls_by_depth: Counter = field(default_factory=Counter)
    saturated_leaves: list[tuple[float, float, float]] = field(default_factory=list)


def discover(places: Places, circles, min_radius_m: float = MIN_RADIUS_M) -> Discovery:
    """Nearby Search over circles, deduped by place id. A circle that returns the full 20
    results may have more, so it is split into four covering circles, recursively, while the
    children stay at or above min_radius_m. Children outside every in-scope NTA are dropped.
    A circle that still hits the cap at the floor is reported in saturated_leaves."""
    out = Discovery()
    queue = [(lat, lng, r, 0) for lat, lng, r in circles]
    while queue:
        lat, lng, r, depth = queue.pop()
        results = places.nearby(lat, lng, r)
        out.calls_by_depth[depth] += 1
        for p in results:
            out.places.setdefault(p["id"], p)
        if len(results) < NEARBY_MAX_RESULTS:
            continue
        if r / math.sqrt(2) < min_radius_m:
            out.saturated_leaves.append((lat, lng, r))
            continue
        queue.extend((a, b, c, depth + 1) for a, b, c in split_circle(lat, lng, r) if touches_scope(a, b, c))
    return out


def google_summaries(place: dict) -> dict[str, str | None]:
    return {
        "generative": ((place.get("generativeSummary") or {}).get("overview") or {}).get("text"),
        "editorial": (place.get("editorialSummary") or {}).get("text"),
    }
