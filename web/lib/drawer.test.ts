import { describe, expect, it } from "vitest";
import { safeWebsite, summaryAttribution, triText, triWord, visibleSummary } from "./drawer";

describe("triWord", () => {
  it("maps tri-state to yes / no / unknown", () => {
    expect(triWord(true)).toBe("yes");
    expect(triWord(false)).toBe("no");
    expect(triWord(null)).toBe("unknown");
  });
});

describe("summaryAttribution", () => {
  it("labels generative summaries only", () => {
    expect(summaryAttribution("generative")).toBe("The description above: Summarized with Gemini");
    expect(summaryAttribution("editorial")).toBeNull();
    expect(summaryAttribution("haiku")).toBeNull();
    expect(summaryAttribution(null)).toBeNull();
  });
});

describe("visibleSummary", () => {
  it("hides haiku summaries, shows Google ones", () => {
    expect(visibleSummary({ ai_summary: "x", ai_summary_source: "haiku" })).toBeNull();
    expect(visibleSummary({ ai_summary: "g", ai_summary_source: "generative" })).toBe("g");
    expect(visibleSummary({ ai_summary: "e", ai_summary_source: "editorial" })).toBe("e");
    expect(visibleSummary({ ai_summary: null, ai_summary_source: null })).toBeNull();
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
    expect([triText(true), triText(false), triText(null)]).toEqual(["Yes", "No", "Ask your barista"]);
  });
});
