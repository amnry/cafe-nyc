import json
import math
from functools import lru_cache

from config import GRID_RADIUS_M, NTA_FILE, TARGET_NTAS

M_PER_DEG_LAT = 111_320.0


@lru_cache(maxsize=1)
def neighborhoods() -> tuple[tuple[str, tuple], ...]:
    """(label, polygons) from the official NYC Open Data 2020 NTA boundaries.

    Each polygon is a list of rings (outer first, then holes); ring points are (lng, lat).
    """
    data = json.loads(NTA_FILE.read_text())
    out = []
    for f in data["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        out.append((TARGET_NTAS[f["properties"]["nta2020"]], tuple(tuple(tuple(r) for r in p) for p in polys)))
    return tuple(out)


def _in_ring(lat: float, lng: float, ring) -> bool:
    inside = False
    for (lng1, lat1), (lng2, lat2) in zip(ring, ring[1:] + ring[:1]):
        if (lat1 > lat) != (lat2 > lat):
            if lng < (lng2 - lng1) * (lat - lat1) / (lat2 - lat1) + lng1:
                inside = not inside
    return inside


def _in_polygon(lat: float, lng: float, rings) -> bool:
    return _in_ring(lat, lng, rings[0]) and not any(_in_ring(lat, lng, h) for h in rings[1:])


def labels() -> list[str]:
    return [name for name, _ in neighborhoods()]


def neighborhood_for(lat: float, lng: float) -> str | None:
    """Name of the in-scope NTA containing the point, else None."""
    for name, polys in neighborhoods():
        if any(_in_polygon(lat, lng, rings) for rings in polys):
            return name
    return None


def bounds(margin_m: float = 0) -> tuple[float, float, float, float]:
    """(south, west, north, east) of all in-scope neighborhoods."""
    pts = [pt for _, polys in neighborhoods() for rings in polys for pt in rings[0]]
    lngs, lats = [p[0] for p in pts], [p[1] for p in pts]
    s, n, w, e = min(lats), max(lats), min(lngs), max(lngs)
    mid = (s + n) / 2
    dlat = margin_m / M_PER_DEG_LAT
    dlng = margin_m / (M_PER_DEG_LAT * math.cos(math.radians(mid)))
    return s - dlat, w - dlng, n + dlat, e + dlng


def offset(lat: float, lng: float, north_m: float, east_m: float) -> tuple[float, float]:
    dlat = north_m / M_PER_DEG_LAT
    dlng = east_m / (M_PER_DEG_LAT * math.cos(math.radians(lat)))
    return lat + dlat, lng + dlng


def _seg_dist_m(lat: float, lng: float, a, b) -> float:
    """Metres from (lat, lng) to segment a-b ((lng, lat) points), on a local flat projection."""
    kx = M_PER_DEG_LAT * math.cos(math.radians(lat))
    ax, ay = (a[0] - lng) * kx, (a[1] - lat) * M_PER_DEG_LAT
    bx, by = (b[0] - lng) * kx, (b[1] - lat) * M_PER_DEG_LAT
    dx, dy = bx - ax, by - ay
    seg2 = dx * dx + dy * dy
    t = 0.0 if seg2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / seg2))
    return math.hypot(ax + t * dx, ay + t * dy)


def touches_scope(lat: float, lng: float, radius_m: float) -> bool:
    """True if the circle overlaps any in-scope NTA: its center is inside one, or some
    boundary edge comes within radius_m of the center."""
    if neighborhood_for(lat, lng):
        return True
    dlat = radius_m / M_PER_DEG_LAT
    dlng = radius_m / (M_PER_DEG_LAT * math.cos(math.radians(lat)))
    for ring, (s, w, n, e) in _ring_boxes():
        if not (s - dlat <= lat <= n + dlat and w - dlng <= lng <= e + dlng):
            continue
        if any(_seg_dist_m(lat, lng, a, b) <= radius_m for a, b in zip(ring, ring[1:] + ring[:1])):
            return True
    return False


@lru_cache(maxsize=1)
def _ring_boxes() -> tuple:
    """Every ring of every in-scope polygon with its (south, west, north, east) box."""
    out = []
    for _, polys in neighborhoods():
        for rings in polys:
            for ring in rings:
                lngs, lats = [p[0] for p in ring], [p[1] for p in ring]
                out.append((ring, (min(lats), min(lngs), max(lats), max(lngs))))
    return tuple(out)


def grid_circles(radius_m: float = GRID_RADIUS_M) -> list[tuple[float, float, float]]:
    """Circles (lat, lng, radius_m) covering the in-scope neighborhoods.

    Spacing of radius * sqrt(2) on a square grid leaves no gaps between circles.
    """
    south, west, north, east = bounds()
    step = radius_m * math.sqrt(2)
    circles = []
    row = 0
    lat = south
    while lat <= north + step / M_PER_DEG_LAT:
        lng_step = step / (M_PER_DEG_LAT * math.cos(math.radians(lat)))
        lng = west
        while lng <= east + lng_step:
            if touches_scope(lat, lng, radius_m):
                circles.append((lat, lng, radius_m))
            lng += lng_step
        row += 1
        lat = south + row * step / M_PER_DEG_LAT
    return circles


def split_circle(lat: float, lng: float, radius_m: float) -> list[tuple[float, float, float]]:
    """Four circles covering a circle that hit the 20-result cap.

    Children sit at the centers of the four quadrants of the parent's bounding square, with
    radius r/sqrt(2) so each covers its whole quadrant (and so the parent disk, with no gaps).
    """
    child = radius_m / math.sqrt(2)
    return [offset(lat, lng, dn * radius_m / 2, de * radius_m / 2) + (child,) for dn in (-1, 1) for de in (-1, 1)]
