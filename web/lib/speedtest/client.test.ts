import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeviceId } from "../deviceId";
import { clientMessage, formatMbps, progressAt, startTest, submitResult, toResults } from "./client";
import { SPEEDTEST_CONFIG } from "./client-config";
import { REJECT_REASONS } from "./reasons";

afterEach(() => vi.unstubAllGlobals());

describe("SPEEDTEST_CONFIG (15 s sequence)", () => {
  it("runs on tap only, with no loaded-latency measurements", () => {
    expect(SPEEDTEST_CONFIG.autoStart).toBe(false);
    expect(SPEEDTEST_CONFIG.measureDownloadLoadedLatency).toBe(false);
    expect(SPEEDTEST_CONFIG.measureUploadLoadedLatency).toBe(false);
    expect(SPEEDTEST_CONFIG.bandwidthFinishRequestDuration).toBe(1000);
  });
  it("is latency 10; download 100kB x1, 1MB x4, 10MB x3, 25MB x1; upload 100kB x2, 1MB x4, 5MB x2", () => {
    const m = (SPEEDTEST_CONFIG.measurements ?? []).map((x) => {
      const r = x as { type: string; numPackets?: number; bytes?: number; count?: number };
      return r.type === "latency" ? `latency:${r.numPackets}` : `${r.type}:${r.bytes}x${r.count}`;
    });
    expect(m).toEqual([
      "latency:10",
      "download:100000x1", "download:1000000x4", "download:10000000x3", "download:25000000x1",
      "upload:100000x2", "upload:1000000x4", "upload:5000000x2",
    ]);
  });
});

describe("toResults / progressAt / formatMbps", () => {
  it("converts bps to Mbps", () => {
    expect(toResults({ download: 85_123_456, upload: 20_000_000, latency: 14.567, jitter: 2 })).toEqual({
      down_mbps: 85.12, up_mbps: 20, latency_ms: 14.57, jitter_ms: 2,
    });
  });
  it("is null when any value is missing", () => {
    expect(toResults({ download: 1e6, upload: 1e6, latency: 5 })).toBeNull();
    expect(toResults({})).toBeNull();
  });
  it("progress rises over ~15 s and holds at 95% until finished", () => {
    expect(progressAt(0)).toBe(0);
    expect(progressAt(7500)).toBeCloseTo(0.5);
    expect(progressAt(60_000)).toBe(0.95);
  });
  it("formats Mbps", () => {
    expect(formatMbps(85.04)).toBe("85.0");
    expect(formatMbps(412.6)).toBe("413");
  });
});

describe("API calls", () => {
  const reply = (status: number, body: unknown) => vi.stubGlobal("fetch", vi.fn(async () => Response.json(body, { status })));
  const args = { cafe_id: "c", turnstile_token: "t", lat: 1, lng: 2, accuracy_m: 5, device_id: "d" };

  it("start returns the session token", async () => {
    reply(200, { status: "ok", session_token: "tok" });
    expect(await startTest(args)).toEqual({ ok: true, session_token: "tok" });
  });
  it("shows the plain-English message for a reject reason", async () => {
    reply(403, { status: "rejected", reason: "mobile_network", message: "ignored" });
    expect(await startTest(args)).toEqual({ ok: false, reason: "mobile_network", message: REJECT_REASONS.mobile_network.message });
  });
  it("Private Relay says what to do", async () => {
    reply(403, { status: "rejected", reason: "private_relay" });
    const r = await startTest(args);
    expect(!r.ok && r.message).toBe("Turn off Private Relay for this site, or use Chrome.");
  });
  it("treats an unknown reason or a network failure as a generic error", async () => {
    reply(500, { error: "x" });
    expect(await submitResult("t", { down_mbps: 1, up_mbps: 1, latency_ms: 1, jitter_ms: 0 })).toMatchObject({ ok: false, message: clientMessage("network") });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await startTest(args)).toMatchObject({ ok: false, reason: "network" });
  });
  it("submit succeeds on ok", async () => {
    reply(200, { status: "ok" });
    expect(await submitResult("t", { down_mbps: 1, up_mbps: 1, latency_ms: 1, jitter_ms: 0 })).toEqual({ ok: true });
  });
});

describe("getDeviceId", () => {
  it("creates once and reuses it", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    const a = getDeviceId();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId()).toBe(a);
  });
  it("falls back to an in-memory id when storage throws", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    const a = getDeviceId();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDeviceId()).toBe(a);
  });
});
