import type { AiSummarySource, Cafe, TriState } from "./types";

export const GEMINI_LABEL = "Summarized with Gemini";

/** Summary to show, or null. Haiku fallback summaries are kept in the data but not shown. */
export function visibleSummary(cafe: Pick<Cafe, "ai_summary" | "ai_summary_source">): string | null {
  return cafe.ai_summary_source === "haiku" ? null : cafe.ai_summary;
}

/** Only Google's generative summaries carry the required Gemini label; editorial and Haiku do not. */
export function summaryAttribution(source: AiSummarySource | null): string | null {
  return source === "generative" ? GEMINI_LABEL : null;
}

/** http(s) links only, so a malformed or hostile value from the data never becomes a javascript: href. */
export function safeWebsite(url: string | null): { href: string; host: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return { href: u.href, host: u.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}

/** Display text. Unknown is never "No": it reads as a nudge to ask. */
export function triText(v: TriState): "Yes" | "No" | "Ask your barista" {
  return v === true ? "Yes" : v === false ? "No" : "Ask your barista";
}
