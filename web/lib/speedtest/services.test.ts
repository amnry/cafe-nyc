import { describe, expect, it } from "vitest";
import { createDb } from "./db";
import { lookupAsn } from "./ipinfo";
import { verifyTurnstile } from "./turnstile";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(body, { status, headers });

describe("lookupAsn", () => {
  it("parses the ipinfo lite response", async () => {
    const f = (async () => json({ asn: "AS7018", as_name: "AT&T Enterprises" })) as unknown as typeof fetch;
    expect(await lookupAsn("1.2.3.4", "tok", f)).toEqual({ asn: 7018, asn_org: "AT&T Enterprises" });
  });
  it("is null on HTTP errors, junk, or network failure", async () => {
    expect(await lookupAsn("1.2.3.4", "t", (async () => json({}, 500)) as unknown as typeof fetch)).toBeNull();
    expect(await lookupAsn("1.2.3.4", "t", (async () => json({ asn: "" })) as unknown as typeof fetch)).toBeNull();
    expect(await lookupAsn("1.2.3.4", "t", (async () => { throw new Error("down"); }) as typeof fetch)).toBeNull();
  });
});

describe("verifyTurnstile", () => {
  it("is true only on success: true", async () => {
    const ok = (async () => json({ success: true })) as unknown as typeof fetch;
    const no = (async () => json({ success: false })) as unknown as typeof fetch;
    const err = (async () => { throw new Error("down"); }) as typeof fetch;
    expect(await verifyTurnstile("t", "1.2.3.4", "s", ok)).toBe(true);
    expect(await verifyTurnstile("t", "1.2.3.4", "s", no)).toBe(false);
    expect(await verifyTurnstile("t", "1.2.3.4", "s", err)).toBe(false);
  });
});

describe("createDb", () => {
  it("uses the service role key and treats a unique-nonce 409 as a conflict", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: 409 });
    }) as unknown as typeof fetch;
    const db = createDb("https://x.supabase.co/", "service-key", f);
    expect(await db.insertTest({ cafe_id: "c", down_mbps: 1, up_mbps: 1, latency_ms: 1, jitter_ms: 0, ip_prefix_hash: "h", asn: 1, asn_org: null, distance_m: 0, accuracy_m: 0, device_id_hash: "d", status: "accepted", reject_reason: null, nonce: "n" })).toBe("nonce_conflict");
    expect(calls[0].url).toBe("https://x.supabase.co/rest/v1/speed_tests");
    expect((calls[0].init?.headers as Record<string, string>).apikey).toBe("service-key");
  });
  it("counts issued starts from the content-range total", async () => {
    const f = (async () => new Response(null, { status: 200, headers: { "content-range": "*/7" } })) as unknown as typeof fetch;
    expect(await createDb("https://x", "k", f).countIssuedStarts({ device_id_hash: "d", since: new Date(0) })).toBe(7);
  });
  it("only returns visible cafes with coordinates", async () => {
    let url = "";
    const f = (async (u: string) => { url = u; return json([{ lat: 1, lng: 2 }]); }) as unknown as typeof fetch;
    expect(await createDb("https://x", "k", f).getCafe("abc")).toEqual({ lat: 1, lng: 2 });
    expect(url).toContain("hidden=eq.false");
    expect(await createDb("https://x", "k", (async () => json([])) as unknown as typeof fetch).getCafe("abc")).toBeNull();
  });
  it("reads the known ASN from the rpc", async () => {
    expect(await createDb("https://x", "k", (async () => json(7018)) as unknown as typeof fetch).knownAsn("c")).toBe(7018);
    expect(await createDb("https://x", "k", (async () => json(null)) as unknown as typeof fetch).knownAsn("c")).toBeNull();
  });
});
