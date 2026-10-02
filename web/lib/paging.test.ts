import { describe, expect, it } from "vitest";
import { nextBatch, PAGE_SIZE } from "./paging";

describe("nextBatch", () => {
  it("page size is 20", () => {
    expect(PAGE_SIZE).toBe(20);
  });
  it("adds a full page when plenty are left", () => {
    expect(nextBatch(PAGE_SIZE, 100)).toBe(PAGE_SIZE);
  });
  it("adds only what is left", () => {
    expect(nextBatch(PAGE_SIZE, PAGE_SIZE + 6)).toBe(6);
  });
  it("adds nothing when all are shown", () => {
    expect(nextBatch(PAGE_SIZE, PAGE_SIZE)).toBe(0);
    expect(nextBatch(PAGE_SIZE, 10)).toBe(0);
  });
});
