import { describe, expect, it } from "vitest";
import { checkElapsed, parseResults, resultsPlausible } from "./bounds";

const ok = { down_mbps: 85, up_mbps: 20, latency_ms: 15, jitter_ms: 2 };

describe("checkElapsed (5 to 120 s)", () => {
  it("accepts the edges", () => {
    expect(checkElapsed(5)).toBe("ok");
    expect(checkElapsed(120)).toBe("ok");
    expect(checkElapsed(15)).toBe("ok");
  });
  it("rejects outside", () => {
    expect(checkElapsed(4.9)).toBe("too_fast");
    expect(checkElapsed(120.1)).toBe("too_slow");
  });
});

describe("resultsPlausible", () => {
  it("accepts typical results and the bounds", () => {
    expect(resultsPlausible(ok)).toBe(true);
    expect(resultsPlausible({ ...ok, down_mbps: 0.1, up_mbps: 2000, latency_ms: 1 })).toBe(true);
  });
  it("rejects out-of-range values", () => {
    expect(resultsPlausible({ ...ok, down_mbps: 0.09 })).toBe(false);
    expect(resultsPlausible({ ...ok, down_mbps: 2001 })).toBe(false);
    expect(resultsPlausible({ ...ok, up_mbps: 0 })).toBe(false);
    expect(resultsPlausible({ ...ok, latency_ms: 0.5 })).toBe(false);
    expect(resultsPlausible({ ...ok, latency_ms: 2001 })).toBe(false);
    expect(resultsPlausible({ ...ok, jitter_ms: -1 })).toBe(false);
  });
});

describe("parseResults", () => {
  it("needs four finite numbers", () => {
    expect(parseResults(ok)).toEqual(ok);
    expect(parseResults({ ...ok, down_mbps: "85" })).toBeNull();
    expect(parseResults({ ...ok, up_mbps: Infinity })).toBeNull();
    expect(parseResults({ down_mbps: 1 })).toBeNull();
    expect(parseResults(null)).toBeNull();
  });
});
