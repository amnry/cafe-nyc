import { describe, expect, it } from "vitest";
import { fakeFetch, makeDeps, NOW, post, startBody } from "./testkit";
import { handleStart } from "./start";
import { handleSubmit } from "./submit";
import { signSession } from "./token";

const results = { down_mbps: 85, up_mbps: 20, latency_ms: 15, jitter_ms: 2 };

async function started(deps: ReturnType<typeof makeDeps>, headers?: Record<string, string>) {
  const res = await handleStart(post(startBody(), headers), deps);
  return (await res.json()).session_token as string;
}
const submit = (deps: ReturnType<typeof makeDeps>, session_token: string, body: object = { results }, headers?: Record<string, string>) =>
  handleSubmit(post({ session_token, ...body }, headers), deps);
const reasonOf = async (res: Response) => (await res.json()).reason;
const later = (deps: ReturnType<typeof makeDeps>, seconds: number) => ({ ...deps, now: () => NOW + seconds * 1000 }) as typeof deps;

describe("POST /submit", () => {
  it("accepts a good result for a cafe with no known network, and refreshes the site", async () => {
    const deps = makeDeps();
    const token = await started(deps);
    const res = await submit(later(deps, 15), token);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(deps.db.tests).toHaveLength(1);
    expect(deps.db.tests[0]).toMatchObject({ status: "accepted", down_mbps: 85, asn: 7018, distance_m: 0, accuracy_m: 20, nonce: "nonce-1" });
    expect(deps.accepted).toBe(1);
    expect(JSON.stringify(deps.db.tests)).not.toContain("203.0.113.7");
  });

  it("accepts when the ASN matches the cafe's known network", async () => {
    const deps = makeDeps();
    deps.db.known = 7018;
    await submit(later(deps, 15), await started(deps));
    expect(deps.db.tests[0].status).toBe("accepted");
  });

  it("flags (and does not refresh the site) when the ASN differs from the known network", async () => {
    const deps = makeDeps();
    deps.db.known = 701;
    const res = await submit(later(deps, 15), await started(deps));
    expect(await res.json()).toEqual({ status: "ok" }); // the client is not told
    expect(deps.db.tests[0]).toMatchObject({ status: "flagged", reject_reason: null });
    expect(deps.accepted).toBe(0);
  });

  describe("token", () => {
    it("an invalid signature is rejected and not stored", async () => {
      const deps = makeDeps();
      const res = await submit(deps, "garbage.token");
      expect(res.status).toBe(400);
      expect(await reasonOf(res)).toBe("invalid_token");
      expect(deps.db.tests).toHaveLength(0);
    });
    it("a token signed with another secret is rejected", async () => {
      const deps = makeDeps();
      const forged = signSession({ cafe_id: "x", ip_prefix_hash: "x", asn: 1, asn_org: null, issued_at: NOW, nonce: "n", device_id_hash: "d", distance_m: 0, accuracy_m: 0 }, "wrong");
      expect(await reasonOf(await submit(deps, forged))).toBe("invalid_token");
    });
    it("an expired token is rejected and stored with the reason", async () => {
      const deps = makeDeps();
      const token = await started(deps);
      const res = await submit(later(deps, 301), token);
      expect(await reasonOf(res)).toBe("token_expired");
      expect(deps.db.tests[0]).toMatchObject({ status: "rejected", reject_reason: "token_expired" });
    });
    it("rejects a missing token or body", async () => {
      expect(await reasonOf(await handleSubmit(post({ results }), makeDeps()))).toBe("bad_request");
    });
  });

  describe("nonce", () => {
    it("a token can be submitted once; the replay is rejected and the first result stands", async () => {
      const deps = makeDeps();
      const token = await started(deps);
      const first = later(deps, 15);
      expect((await submit(first, token)).status).toBe(200);
      const replay = await submit(first, token, { results: { ...results, down_mbps: 1500 } });
      expect(replay.status).toBe(409);
      expect(await reasonOf(replay)).toBe("nonce_reused");
      const accepted = deps.db.tests.filter((t) => t.status === "accepted");
      expect(accepted).toHaveLength(1);
      expect(accepted[0].down_mbps).toBe(85);
      expect(deps.db.tests.at(-1)).toMatchObject({ status: "rejected", reject_reason: "nonce_reused", nonce: null });
      expect(deps.accepted).toBe(1);
    });
    it("a rejected submit also uses up the nonce", async () => {
      const deps = makeDeps();
      const token = await started(deps);
      await submit(later(deps, 1), token); // too_fast
      expect(await reasonOf(await submit(later(deps, 15), token))).toBe("nonce_reused");
    });
  });

  describe("network", () => {
    const otherNet = (asn: string) => fakeFetch({ asn: { "203.0.113.7": { asn: "AS7018", as_name: "AT&T" }, "198.51.100.4": { asn, as_name: "x" } } });

    it("same /24 passes without an ASN lookup", async () => {
      const deps = makeDeps();
      const token = await started(deps, { "x-real-ip": "203.0.113.7" });
      const res = await submit(later(deps, 15), token, { results }, { "x-real-ip": "203.0.113.99" });
      expect(res.status).toBe(200);
    });
    it("a different /24 on the same ASN passes (dual-stack, rotating address)", async () => {
      const deps = makeDeps({ fetch: otherNet("AS7018") });
      const token = await started(deps, { "x-real-ip": "203.0.113.7" });
      expect((await submit(later(deps, 15), token, { results }, { "x-real-ip": "198.51.100.4" })).status).toBe(200);
    });
    it("a different /24 and a different ASN is ip_changed", async () => {
      const deps = makeDeps({ fetch: otherNet("AS7922") });
      const token = await started(deps, { "x-real-ip": "203.0.113.7" });
      const res = await submit(later(deps, 15), token, { results }, { "x-real-ip": "198.51.100.4" });
      expect(await reasonOf(res)).toBe("ip_changed");
      expect(deps.db.tests[0]).toMatchObject({ status: "rejected", reject_reason: "ip_changed" });
    });
    it("a failed ASN lookup on a changed /24 is ip_changed", async () => {
      const deps = makeDeps({ fetch: fakeFetch({ asn: { "203.0.113.7": { asn: "AS7018", as_name: "x" }, "198.51.100.4": null } }) });
      const token = await started(deps, { "x-real-ip": "203.0.113.7" });
      expect(await reasonOf(await submit(later(deps, 15), token, { results }, { "x-real-ip": "198.51.100.4" }))).toBe("ip_changed");
    });
  });

  describe("elapsed time (5 to 120 s)", () => {
    it.each([
      [4, "too_fast"],
      [121, "too_slow"],
    ])("%d s is %s", async (secs, reason) => {
      const deps = makeDeps();
      const res = await submit(later(deps, secs), await started(deps));
      expect(await reasonOf(res)).toBe(reason);
      expect(deps.db.tests[0]).toMatchObject({ status: "rejected", reject_reason: reason });
    });
    it.each([5, 120])("%d s is accepted", async (secs) => {
      const deps = makeDeps();
      expect((await submit(later(deps, secs), await started(deps))).status).toBe(200);
    });
  });

  describe("plausible bounds", () => {
    it.each([
      { ...results, down_mbps: 2500 },
      { ...results, up_mbps: 0.01 },
      { ...results, latency_ms: 0 },
      { ...results, latency_ms: 5000 },
    ])("rejects %o", async (bad) => {
      const deps = makeDeps();
      const res = await submit(later(deps, 15), await started(deps), { results: bad });
      expect(await reasonOf(res)).toBe("implausible_results");
      expect(deps.db.tests[0].status).toBe("rejected");
    });
    it("rejects missing or non-numeric results", async () => {
      const deps = makeDeps();
      const res = await submit(later(deps, 15), await started(deps), { results: { down_mbps: "fast" } });
      expect(await reasonOf(res)).toBe("implausible_results");
      expect(deps.db.tests[0]).toMatchObject({ down_mbps: null, status: "rejected" });
    });
  });
});
