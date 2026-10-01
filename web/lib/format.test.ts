import { describe, expect, it } from "vitest";
import { formatCount, shortAddress } from "./format";

describe("shortAddress", () => {
  it("keeps the street line only", () => {
    expect(shortAddress("204 W 10th St, New York, NY 10014, USA")).toBe("204 W 10th St");
    expect(shortAddress(null)).toBeNull();
    expect(shortAddress("")).toBeNull();
  });
});

describe("formatCount", () => {
  it("adds thousands separators", () => {
    expect(formatCount(4894)).toBe("4,894");
  });
});
