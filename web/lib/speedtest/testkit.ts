// Shared fixtures for the speed-test unit tests (in-memory Db, fake network, deps builder).
import type { Db, StartCount, StartRow, TestRow } from "./db";
import type { Deps } from "./deps";

export const CAFE_ID = "11111111-1111-4111-8111-111111111111";
// Arbitrary coordinates; 0.001 degrees of latitude is about 111 m.
export const CAFE = { lat: 40.7, lng: -74.0 };
export const NOW = Date.parse("2026-10-01T15:00:00Z");

export class FakeDb implements Db {
  starts: StartRow[] = [];
  tests: TestRow[] = [];
  startCreatedAt = new Map<StartRow, number>();
  known: number | null = null;
  cafe: { lat: number; lng: number } | null = CAFE;
  constructor(private clock: () => number = () => NOW) {}

  async getCafe() {
    return this.cafe;
  }
  async countIssuedStarts(by: StartCount) {
    return this.starts.filter((s) => {
      if (s.status !== "issued") return false;
      if ((this.startCreatedAt.get(s) ?? 0) < by.since.getTime()) return false;
      return "cafe_id" in by ? s.cafe_id === by.cafe_id && s.ip_prefix_hash === by.ip_prefix_hash : s.device_id_hash === by.device_id_hash;
    }).length;
  }
  async insertStart(row: StartRow) {
    this.starts.push(row);
    this.startCreatedAt.set(row, this.clock());
  }
  async insertTest(row: TestRow) {
    if (row.nonce !== null && this.tests.some((t) => t.nonce === row.nonce)) return "nonce_conflict" as const;
    this.tests.push(row);
    return "ok" as const;
  }
  async knownAsn() {
    return this.known;
  }
}

export interface Net {
  turnstile: boolean;
  asn: Record<string, { asn: string; as_name: string } | null>; // by IP; "*" is the default
}

/** Fake fetch for Turnstile siteverify and the ipinfo lite API. */
export function fakeFetch(net: Partial<Net> = {}): typeof fetch {
  const cfg: Net = { turnstile: true, asn: { "*": { asn: "AS7018", as_name: "AT&T Internet" } }, ...net };
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("challenges.cloudflare.com")) return Response.json({ success: cfg.turnstile });
    const m = url.match(/api\.ipinfo\.io\/lite\/([^?]+)/);
    if (m) {
      const hit = cfg.asn[decodeURIComponent(m[1])] ?? cfg.asn["*"];
      return hit ? Response.json(hit) : new Response("nope", { status: 500 });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
}

export function makeDeps(over: Partial<Deps> & { db?: FakeDb } = {}): Deps & { db: FakeDb; accepted: number } {
  let n = 0;
  const state = { accepted: 0 };
  const deps = {
    db: new FakeDb(),
    fetch: fakeFetch(),
    now: () => NOW,
    nonce: () => `nonce-${++n}`,
    dev: false,
    env: { turnstileSecret: "ts", ipinfoToken: "ip", tokenSecret: "token-secret", ipSalt: "salt" },
    onAccepted: () => void state.accepted++,
    ...over,
  };
  return Object.defineProperty(deps, "accepted", { get: () => state.accepted }) as Deps & { db: FakeDb; accepted: number };
}

export const post = (body: unknown, headers: Record<string, string> = { "x-real-ip": "203.0.113.7" }) =>
  new Request("http://localhost/api", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

export const startBody = (over: Record<string, unknown> = {}) => ({
  cafe_id: CAFE_ID, turnstile_token: "tok", lat: CAFE.lat, lng: CAFE.lng, accuracy_m: 20, device_id: "device-0001", ...over,
});
