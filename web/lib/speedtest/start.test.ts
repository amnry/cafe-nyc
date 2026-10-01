import { describe, expect, it } from "vitest";
import { CAFE, CAFE_ID, fakeFetch, makeDeps, NOW, post, startBody } from "./testkit";
import { handleStart } from "./start";
import { verifySession } from "./token";

const run = (deps: ReturnType<typeof makeDeps>, body: unknown = startBody(), headers?: Record<string, string>) =>
  handleStart(post(body, headers), deps);
const reasonOf = async (res: Response) => (await res.json()).reason;

describe("POST /start", () => {
  it("issues a signed token and logs the start without raw IP or coordinates", async () => {
    const deps = makeDeps();
    const res = await run(deps);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    const v = verifySession(body.session_token, "token-secret", NOW + 1000);
    expect(v.ok && v.payload).toMatchObject({ cafe_id: CAFE_ID, asn: 7018, nonce: "nonce-1", distance_m: 0, accuracy_m: 20 });
    expect(deps.db.starts).toHaveLength(1);
    expect(deps.db.starts[0]).toMatchObject({ status: "issued", nonce: "nonce-1", asn: 7018 });
    const stored = JSON.stringify([deps.db.starts, body]);
    expect(stored).not.toContain("203.0.113.7");
    expect(stored).not.toContain(String(CAFE.lat));
    expect(stored).not.toContain("device-0001");
  });

  describe("input", () => {
    it("rejects malformed bodies", async () => {
      for (const body of [null, "x", startBody({ cafe_id: "nope" }), startBody({ lat: 91 }), startBody({ lng: "1" }), startBody({ accuracy_m: -1 }), startBody({ device_id: "x" }), startBody({ turnstile_token: "" })]) {
        expect(await reasonOf(await run(makeDeps(), body))).toBe("bad_request");
      }
    });
    it("needs a client IP", async () => {
      expect(await reasonOf(await run(makeDeps(), startBody(), {}))).toBe("no_client_ip");
    });
    it("404s an unknown or hidden cafe", async () => {
      const deps = makeDeps();
      deps.db.cafe = null;
      const res = await run(deps);
      expect(res.status).toBe(404);
      expect(await reasonOf(res)).toBe("cafe_not_found");
    });
  });

  describe("checks, in order", () => {
    it("Turnstile failure is rejected and not stored", async () => {
      const deps = makeDeps({ fetch: fakeFetch({ turnstile: false }) });
      const res = await run(deps);
      expect(res.status).toBe(403);
      expect(await reasonOf(res)).toBe("turnstile_failed");
      expect(deps.db.starts).toHaveLength(0);
    });
    it("a token for another hostname or action is rejected (outside development)", async () => {
      const wrongHost = makeDeps({ fetch: fakeFetch({ turnstileHostname: "evil.example" }) });
      expect(await reasonOf(await run(wrongHost))).toBe("turnstile_failed");
      const wrongAction = makeDeps({ fetch: fakeFetch({ turnstileAction: "login" }) });
      expect(await reasonOf(await run(wrongAction))).toBe("turnstile_failed");
    });
    it("checks the hostname against the one calling us, from x-forwarded-host", async () => {
      const deps = makeDeps({ fetch: fakeFetch({ turnstileHostname: "3rdplacenyc.com" }) });
      const res = await run(deps, startBody(), { "x-real-ip": "203.0.113.7", "x-forwarded-host": "3rdplacenyc.com" });
      expect(res.status).toBe(200);
    });
    it("skips the action and hostname check in development (test keys)", async () => {
      const deps = makeDeps({ dev: true, fetch: fakeFetch({ turnstileHostname: "example.com", turnstileAction: "" }) });
      expect((await run(deps)).status).toBe(200);
    });
    it("Private Relay comes before the geofence and ASN", async () => {
      const deps = makeDeps();
      const res = await run(deps, startBody({ lat: CAFE.lat + 0.05 }), { "x-real-ip": "172.224.226.5" });
      expect(await reasonOf(res)).toBe("private_relay");
      expect(deps.db.starts[0]).toMatchObject({ status: "rejected", reject_reason: "private_relay" });
    });
    it("too_far at ~500 m; the rejected start keeps distance_m, not coordinates", async () => {
      const deps = makeDeps();
      const res = await run(deps, startBody({ lat: CAFE.lat + 0.0045 }));
      expect(await reasonOf(res)).toBe("too_far");
      expect(deps.db.starts[0].distance_m).toBeGreaterThan(450);
      expect(JSON.stringify(deps.db.starts)).not.toContain(String(CAFE.lng));
    });
    it("applies the accuracy credit", async () => {
      const near = startBody({ lat: CAFE.lat + 0.0011, accuracy_m: 60 }); // ~122 m away, 60 m credit
      expect((await run(makeDeps(), near)).status).toBe(200);
      const farther = startBody({ lat: CAFE.lat + 0.0011, accuracy_m: 20 });
      expect(await reasonOf(await run(makeDeps(), farther))).toBe("too_far");
    });
    it("low_accuracy over 300 m", async () => {
      expect(await reasonOf(await run(makeDeps(), startBody({ accuracy_m: 301 })))).toBe("low_accuracy");
    });
    it("mobile_network", async () => {
      const deps = makeDeps({ fetch: fakeFetch({ asn: { "*": { asn: "AS21928", as_name: "T-Mobile USA" } } }) });
      const res = await run(deps);
      expect(await reasonOf(res)).toBe("mobile_network");
      expect(deps.db.starts[0]).toMatchObject({ status: "rejected", asn: 21928 });
    });
    it("vpn_or_hosting", async () => {
      const deps = makeDeps({ fetch: fakeFetch({ asn: { "*": { asn: "AS16509", as_name: "Amazon" } } }) });
      expect(await reasonOf(await run(deps))).toBe("vpn_or_hosting");
    });
    it("fails closed when the ASN lookup fails", async () => {
      const deps = makeDeps({ fetch: fakeFetch({ asn: { "*": null } }) });
      const res = await run(deps);
      expect(res.status).toBe(503);
      expect(await reasonOf(res)).toBe("asn_lookup_failed");
    });
  });

  describe("rate limits", () => {
    it("allows 10 issued starts per (cafe, ip prefix) per hour, then blocks the 11th", async () => {
      const deps = makeDeps();
      for (let i = 0; i < 10; i++) {
        const res = await run(deps, startBody({ device_id: `device-${i}-xxxx` }));
        expect(res.status, `start ${i + 1}`).toBe(200);
      }
      const res = await run(deps, startBody({ device_id: "device-11-xxxx" }));
      expect(res.status).toBe(429);
      expect(await reasonOf(res)).toBe("rate_limited_cafe");
    });
    it("does not count rejected starts toward the limit", async () => {
      const deps = makeDeps();
      for (let i = 0; i < 12; i++) await run(deps, startBody({ lat: CAFE.lat + 0.01 })); // too_far
      expect((await run(deps)).status).toBe(200);
    });
    it("the hour window slides: older starts do not count", async () => {
      const deps = makeDeps();
      for (let i = 0; i < 10; i++) await run(deps, startBody({ device_id: `device-${i}-xxxx` }));
      const later = makeDeps({ db: deps.db, now: () => NOW + 3_700_000 });
      expect((await run(later, startBody({ device_id: "device-new-xxxx" }))).status).toBe(200);
    });
    it("allows 10 per device per day across cafes/networks, then blocks", async () => {
      const deps = makeDeps();
      for (let i = 0; i < 10; i++) {
        const res = await run(deps, startBody(), { "x-real-ip": `198.51.${i}.9` }); // distinct prefixes
        expect(res.status, `start ${i + 1}`).toBe(200);
      }
      const res = await run(deps, startBody(), { "x-real-ip": "198.51.99.9" });
      expect(res.status).toBe(429);
      expect(await reasonOf(res)).toBe("rate_limited_device");
    });
  });
});
