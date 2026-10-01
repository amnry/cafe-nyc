import time

import requests

from config import CAFE_PRIMARY_TYPES, NEARBY_MAX_RESULTS
from geo import bounds, split_circle
from stats import Stats

BASE = "https://places.googleapis.com/v1"

DETAILS_MASK = ",".join([
    "id", "displayName", "formattedAddress", "location", "websiteUri", "googleMapsUri",
    "rating", "userRatingCount", "priceLevel", "businessStatus", "regularOpeningHours",
    "restroom", "allowsDogs", "outdoorSeating", "reservable", "servesWine",
    "generativeSummary", "editorialSummary", "primaryTypeDisplayName", "primaryType", "types",
])
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


class Places:
    def __init__(self, api_key: str, stats: Stats):
        self._key = api_key
        self._stats = stats

    def _request(self, kind: str, method: str, url: str, mask: str, body=None) -> dict:
        headers = {"X-Goog-Api-Key": self._key, "X-Goog-FieldMask": mask}
        for attempt in range(3):
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
            "locationRestriction": {"circle": {
                "center": {"latitude": lat, "longitude": lng}, "radius": radius_m,
            }},
        }
        data = self._request("nearby_search", "POST", f"{BASE}/places:searchNearby", SEARCH_MASK, body)
        return data.get("places", [])

    def details(self, place_id: str) -> dict:
        return self._request("place_details", "GET", f"{BASE}/places/{place_id}", DETAILS_MASK)


def discover(places: Places, circles) -> dict[str, dict]:
    """Nearby Search over circles, deduped by place id. Circles that hit the
    20-result cap are split into four half-radius circles (max 2 levels)."""
    found: dict[str, dict] = {}
    queue = [(lat, lng, r, 0) for lat, lng, r in circles]
    while queue:
        lat, lng, r, depth = queue.pop()
        results = places.nearby(lat, lng, r)
        for p in results:
            found.setdefault(p["id"], p)
        if len(results) >= NEARBY_MAX_RESULTS and depth < 2:
            queue.extend((a, b, c, depth + 1) for a, b, c in split_circle(lat, lng, r))
    return found
