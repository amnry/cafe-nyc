import { Check, CircleHelp, ExternalLink, X } from "lucide-react";
import { triText } from "@/lib/drawer";
import { priceTier } from "@/lib/filters";
import { formatCount } from "@/lib/format";
import type { OpenStatus } from "@/lib/hours";
import type { Cafe, TriState } from "@/lib/types";

const PRICE_WORDS = ["", "Inexpensive", "Moderate", "Expensive", "Very expensive"];

/** Small monospace caps label, used for row labels and meta lines. */
export const MONO_LABEL = "font-mono text-[9.5px] uppercase tracking-[0.16em]";

/** Small outlined button that fills with amber on hover. */
export const OUTLINE_BUTTON =
  `relative z-10 inline-flex items-center gap-1 border border-line px-2 py-1 ${MONO_LABEL} text-foreground ` +
  "transition-colors duration-150 hover:border-foreground hover:bg-accent hover:text-accent-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground motion-reduce:transition-none";

export function PriceLevel({ level }: { level: number | null }) {
  const tier = priceTier(level);
  if (tier === null) return null;
  return (
    <span className="font-mono text-[13px] tabular-nums" aria-label={`Price: ${PRICE_WORDS[tier]}`} title={PRICE_WORDS[tier]}>
      <span className="text-foreground">{"$".repeat(tier)}</span>
      <span className="text-dim" aria-hidden>
        {"$".repeat(4 - tier)}
      </span>
    </span>
  );
}

export function Rating({ cafe }: { cafe: Cafe }) {
  if (cafe.rating === null) return null;
  return (
    <span className="inline-flex items-baseline gap-1 text-[13px]" aria-label={`Rated ${cafe.rating} out of 5`}>
      <span className="text-accent-deep" aria-hidden>★</span>
      <span className="font-medium tabular-nums">{cafe.rating.toFixed(1)}</span>
      {cafe.rating_count !== null && (
        <span className="font-mono text-[10px] text-muted tabular-nums">({formatCount(cafe.rating_count)})</span>
      )}
    </span>
  );
}

/** Tri-state value: yes / no / unknown differ by glyph and tone. Unknown is never styled as "no". */
export function TriValue({ value }: { value: TriState }) {
  const Icon = value === true ? Check : value === false ? X : CircleHelp;
  const tone = value === true ? "text-foreground" : value === false ? "text-muted" : "text-dim";
  return (
    <span className={`inline-flex items-center gap-1 text-[13px] ${tone}`}>
      <Icon size={13} strokeWidth={value === null ? 1.75 : 2.5} aria-hidden />
      {triText(value)}
    </span>
  );
}

export function StatusText({ status, long = false }: { status: OpenStatus | null; long?: boolean }) {
  // null until the client clock exists; keep the line height so nothing shifts.
  if (!status) return <span className="text-[13px] text-dim">—</span>;
  const tone = status.state === "open" ? "text-open" : status.state === "closed" ? "text-muted" : "text-dim";
  return <span className={`${long ? "text-sm" : "text-[13px]"} font-medium ${tone}`}>{long ? status.label : status.short}</span>;
}

export function StaleNote({ cafe }: { cafe: Cafe }) {
  if (cafe.is_fresh !== false) return null;
  return <p className={`${MONO_LABEL} text-muted`}>! Info may be outdated</p>;
}

export function MapsLink({ cafe }: { cafe: Cafe }) {
  if (!cafe.google_maps_uri) return null;
  return (
    <a href={cafe.google_maps_uri} target="_blank" rel="noopener noreferrer" className={OUTLINE_BUTTON}>
      Maps
      <ExternalLink size={11} aria-hidden />
      <span className="sr-only">(opens Google Maps for {cafe.name})</span>
    </a>
  );
}
