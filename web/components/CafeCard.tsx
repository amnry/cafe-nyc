import { Heart } from "lucide-react";
import { visibleSummary } from "@/lib/drawer";
import { streetLine } from "@/lib/format";
import type { OpenStatus } from "@/lib/hours";
import type { Cafe } from "@/lib/types";
import { AttrIcon } from "./AttrIcon";
import { MapsLink, MONO_LABEL, OUTLINE_BUTTON, PriceLevel, Rating, StaleNote, StatusText } from "./bits";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.75rem_1fr] items-center gap-1.5">
      <dt className={`${MONO_LABEL} text-muted`}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function CafeCard({ cafe, status, walk, favorite, onToggleFavorite, onSelect }: {
  cafe: Cafe;
  status: OpenStatus | null;
  walk: string | null; // "6 min walk" when near-me is on
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
  onSelect: (cafe: Cafe) => void;
}) {
  const address = streetLine(cafe.street_address, cafe.address);
  const summary = visibleSummary(cafe);
  return (
    <article
      className="cafe-card relative flex flex-col gap-2 border border-line bg-surface p-3"
    >
      <header className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 font-display text-xl leading-[0.95] font-bold tracking-wide uppercase">
          {/* Stretched button: its ::after covers the card, so the whole card opens the drawer. */}
          <button
            type="button"
            onClick={() => onSelect(cafe)}
            className="text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {cafe.name}
          </button>
        </h2>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? `Remove ${cafe.name} from favorites` : `Save ${cafe.name} to favorites`}
          title={favorite ? "Saved · tap to remove" : "Save for later"}
          onClick={() => onToggleFavorite(cafe.id)}
          className={
            "relative z-10 -m-1.5 shrink-0 p-1.5 transition-colors duration-150 motion-reduce:transition-none " +
            "focus-visible:outline-2 focus-visible:outline-accent " +
            (favorite ? "text-accent" : "text-dim hover:text-foreground")
          }
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} aria-hidden />
        </button>
      </header>

      <p className={`${MONO_LABEL} -mt-0.5 text-muted`}>
        {cafe.neighborhood}
        {address && <> · {address}</>}
      </p>

      {/* Fixed height so cards stay level whichever icons are unknown (and so are not drawn). */}
      <div className="flex h-6 items-center gap-3">
        <Rating cafe={cafe} />
        <PriceLevel level={cafe.price_level} />
        <div className="ml-auto flex items-center">
          <AttrIcon kind="restroom" value={cafe.restroom} />
          <AttrIcon kind="dogs" value={cafe.allows_dogs} />
          <AttrIcon kind="outdoor" value={cafe.outdoor_seating} />
        </div>
      </div>

      <dl>
        <Row label="Hours">
          <span className="flex items-center justify-between gap-2">
            <StatusText status={status} />
            {walk && <span className="font-mono text-[11px] text-accent">{walk}</span>}
          </span>
        </Row>
      </dl>

      {summary && (
        <blockquote className="border-l-2 border-accent bg-surface-2 px-2.5 py-1.5">
          <p className="line-clamp-3 text-[13px] leading-snug text-foreground/90 italic">{summary}</p>
        </blockquote>
      )}

      <StaleNote cafe={cafe} />

      <footer className="mt-auto flex gap-1.5 pt-1">
        <MapsLink cafe={cafe} />
        <button type="button" onClick={() => onSelect(cafe)} className={OUTLINE_BUTTON}>
          Details
        </button>
      </footer>
    </article>
  );
}
