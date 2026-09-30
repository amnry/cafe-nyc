import re
import unicodedata


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def street_parts(address: str | None) -> tuple[str, str]:
    """('141', 'Waverly Pl') from '141 Waverly Pl, New York, NY 10014, USA'."""
    if not address:
        return "", ""
    first = address.split(",")[0].strip()
    m = re.match(r"^(\d[\w/-]*)\s+(.*)$", first)
    if m:
        return m.group(1), m.group(2)
    return "", first


def build_slug(name: str, address: str | None, place_id: str, taken: set[str]) -> str:
    """name + street; on collision add house number, then place id prefix."""
    number, street = street_parts(address)
    base = slugify(f"{name} {street}")
    if not street:
        base = slugify(name)
        candidates = [f"{base}-{slugify(place_id)[:8].lower()}"]
    else:
        candidates = [base]
        if number:
            candidates.append(f"{base}-{slugify(number)}")
        candidates.append(f"{base}-{slugify(place_id)[:8].lower()}")
    for c in candidates:
        if c and c not in taken:
            return c
    raise ValueError(f"cannot build unique slug for {name!r} ({place_id})")
