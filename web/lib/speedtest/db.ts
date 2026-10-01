import "server-only";

// Service-role access to the speed-test tables over PostgREST, like lib/cafes.ts (no supabase-js).
// The tables have no anon access, so this key must never reach the browser.

export interface StartRow {
  cafe_id: string;
  ip_prefix_hash: string;
  device_id_hash: string;
  asn: number | null;
  distance_m: number | null;
  accuracy_m: number | null;
  status: "issued" | "rejected";
  reject_reason: string | null;
  nonce: string | null;
}

export interface TestRow {
  cafe_id: string;
  down_mbps: number | null;
  up_mbps: number | null;
  latency_ms: number | null;
  jitter_ms: number | null;
  ip_prefix_hash: string;
  asn: number | null;
  asn_org: string | null;
  distance_m: number | null;
  accuracy_m: number | null;
  device_id_hash: string | null;
  status: "accepted" | "flagged" | "rejected";
  reject_reason: string | null;
  nonce: string | null;
}

export type StartCount = { cafe_id: string; ip_prefix_hash: string; since: Date } | { device_id_hash: string; since: Date };

export interface Db {
  getCafe(id: string): Promise<{ lat: number; lng: number } | null>;
  countIssuedStarts(by: StartCount): Promise<number>;
  insertStart(row: StartRow): Promise<void>;
  insertTest(row: TestRow): Promise<"ok" | "nonce_conflict">;
  knownAsn(cafe_id: string): Promise<number | null>;
}

export function createDb(baseUrl: string, serviceKey: string, fetchImpl: typeof fetch = fetch): Db {
  const rest = `${baseUrl.replace(/\/$/, "")}/rest/v1`;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const call = (path: string, init: RequestInit = {}) =>
    fetchImpl(`${rest}${path}`, { ...init, headers: { ...headers, ...init.headers }, cache: "no-store" });

  async function ensureOk(res: Response, what: string) {
    if (!res.ok) throw new Error(`${what} failed: HTTP ${res.status}`);
  }

  return {
    async getCafe(id) {
      const res = await call(`/cafes?id=eq.${encodeURIComponent(id)}&hidden=eq.false&select=lat,lng&limit=1`);
      await ensureOk(res, "cafe lookup");
      const [row] = (await res.json()) as { lat: number | null; lng: number | null }[];
      return row && row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null;
    },

    async countIssuedStarts(by) {
      const filter =
        "cafe_id" in by
          ? `cafe_id=eq.${encodeURIComponent(by.cafe_id)}&ip_prefix_hash=eq.${encodeURIComponent(by.ip_prefix_hash)}`
          : `device_id_hash=eq.${encodeURIComponent(by.device_id_hash)}`;
      const res = await call(`/speed_test_starts?status=eq.issued&${filter}&created_at=gte.${by.since.toISOString()}&select=id`, {
        method: "HEAD",
        headers: { Prefer: "count=exact" },
      });
      await ensureOk(res, "start count");
      const total = res.headers.get("content-range")?.split("/")[1];
      const n = Number(total);
      if (!Number.isInteger(n)) throw new Error("start count: missing content-range total");
      return n;
    },

    async insertStart(row) {
      await ensureOk(await call("/speed_test_starts", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=minimal" } }), "start insert");
    },

    async insertTest(row) {
      const res = await call("/speed_tests", { method: "POST", body: JSON.stringify(row), headers: { Prefer: "return=minimal" } });
      if (res.status === 409) return "nonce_conflict"; // unique(nonce)
      await ensureOk(res, "test insert");
      return "ok";
    },

    async knownAsn(cafe_id) {
      const res = await call("/rpc/speedtest_known_asn", { method: "POST", body: JSON.stringify({ p_cafe: cafe_id }) });
      await ensureOk(res, "known asn");
      const v = (await res.json()) as number | null;
      return typeof v === "number" ? v : null;
    },
  };
}
