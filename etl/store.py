from datetime import datetime, timezone

import requests


class Store:
    """Supabase PostgREST access with the service role key (bypasses RLS)."""

    def __init__(self, url: str, service_key: str):
        self.base = f"{url.rstrip('/')}/rest/v1"
        self._headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    def _check(self, r: requests.Response) -> requests.Response:
        if not r.ok:
            raise RuntimeError(f"supabase HTTP {r.status_code}: {r.text[:300]}")
        return r

    def existing(self) -> dict[str, dict]:
        """place_id -> {slug, neighborhood, hidden_reason} for every stored cafe."""
        r = self._check(requests.get(
            f"{self.base}/cafes", params={"select": "google_place_id,slug,neighborhood,hidden_reason"},
            headers=self._headers, timeout=30))
        return {x.pop("google_place_id"): x for x in r.json()}

    def upsert_cafe(self, row: dict) -> str:
        """Upsert on google_place_id; columns absent from row (laptop_*, serves_food) are left
        untouched. NOT NULL columns (slug) must always be present, even on update. Returns cafe id."""
        r = self._check(requests.post(
            f"{self.base}/cafes", params={"on_conflict": "google_place_id"},
            headers={**self._headers, "Prefer": "resolution=merge-duplicates,return=representation"},
            json=row, timeout=30))
        return r.json()[0]["id"]

    def upsert_prices(self, cafe_id: str, prices: list[dict]) -> None:
        if not prices:
            return
        now = datetime.now(timezone.utc).isoformat()
        rows = [{**p, "cafe_id": cafe_id, "observed_at": now} for p in prices]
        self._check(requests.post(
            f"{self.base}/menu_prices", params={"on_conflict": "cafe_id,item"},
            headers={**self._headers, "Prefer": "resolution=merge-duplicates"},
            json=rows, timeout=30))

    def start_run(self) -> str:
        r = self._check(requests.post(
            f"{self.base}/etl_runs", headers={**self._headers, "Prefer": "return=representation"},
            json={}, timeout=30))
        return r.json()[0]["id"]

    def finish_run(self, run_id: str, processed: int, errors: list[str]) -> None:
        self._check(requests.patch(
            f"{self.base}/etl_runs", params={"id": f"eq.{run_id}"}, headers=self._headers,
            json={"finished_at": datetime.now(timezone.utc).isoformat(),
                  "cafes_processed": processed, "errors": errors}, timeout=30))
