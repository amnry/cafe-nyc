import { describe, expect, it } from "vitest";
import { nextBatch, PAGE_SIZE } from "./paging";

describe("nextBatch", () => {
  it("adds a full page when plenty are left", () => {
    expect(nextBatch(PAGE_SIZE, 100)).toBe(PAGE_SIZE);
  });
  it("adds only what is left", () => {
    expect(nextBatch(24, 30)).toBe(6);
  });
  it("adds nothing when all are shown", () => {
    expect(nextBatch(24, 24)).toBe(0);
    expect(nextBatch(24, 10)).toBe(0);
  });
});
