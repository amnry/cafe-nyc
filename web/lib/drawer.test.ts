import { describe, expect, it } from "vitest";
import { safeWebsite, summaryAttribution, triText } from "./drawer";

describe("summaryAttribution", () => {
  it("labels generative summaries only", () => {
    expect(summaryAttribution("generative")).toBe("Summarized with Gemini");
    expect(summaryAttribution("editorial")).toBeNull();
    expect(summaryAttribution("haiku")).toBeNull();
    expect(summaryAttribution(null)).toBeNull();
  });
});

describe("safeWebsite", () => {
  it("accepts http(s) and strips www", () => {
    expect(safeWebsite("http://www.787coffee.com/")).toEqual({ href: "http://www.787coffee.com/", host: "787coffee.com" });
    expect(safeWebsite("https://caffereggio.com/menu")?.host).toBe("caffereggio.com");
  });
  it("rejects other schemes, junk and null", () => {
    expect(safeWebsite("javascript:alert(1)")).toBeNull();
    expect(safeWebsite("not a url")).toBeNull();
    expect(safeWebsite(null)).toBeNull();
  });
});

describe("triText", () => {
  it("never renders unknown as No", () => {
    expect([triText(true), triText(false), triText(null)]).toEqual(["Yes", "No", "Ask the barista"]);
  });
});
