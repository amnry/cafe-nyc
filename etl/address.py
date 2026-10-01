def street_line(components: list[dict] | None) -> str | None:
    """'204 W 10th St' from Places addressComponents (street_number + route, short names).

    Falls back to the route alone when there's no street number; None when neither exists
    (formattedAddress's first segment can be 'East Store' or 'Inside Atelier Jolie').
    """
    def part(kind: str) -> str | None:
        for c in components or []:
            if kind in (c.get("types") or []):
                return (c.get("shortText") or c.get("longText") or "").strip() or None
        return None

    number, route = part("street_number"), part("route")
    if number and route:
        return f"{number} {route}"
    return route
