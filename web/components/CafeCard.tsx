import { ExternalLink } from "lucide-react";
import { priceTier } from "@/lib/filters";
import type { OpenStatus } from "@/lib/hours";
import type { Cafe } from "@/lib/types";
import { TriIcon } from "./TriIcon";

const PRICE_WORDS = ["", "Inexpensive", "Moderate", "Expensive", "Very expensive"];

export function PriceLevel({ level }: { level: number | null }) {
  const tier = priceTier(level);
  if (tier === null) return null;
  return (
    <span className="text-sm font-medium tabular-nums" aria-label={`Price: ${PRICE_WORDS[tier]}`} title={PRICE_WORDS[tier]}>
      {"$".repeat(tier)}
      <span className="text-zinc-300 dark:text-zinc-600" aria-hidden>
        {"$".repeat(4 - tier)}
      </span>
    </span>
  );
}

export function StatusText({ status }: { status: OpenStatus | null }) {
  // status is null until the client clock exists; keep the line's height to avoid layout shift.
  if (!status) return <p className="min-h-5 text-sm text-zinc-400">&nbsp;</p>;
  const tone =
    status.state === "open" ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-500 dark:text-zinc-400";
  return <p className={`min-h-5 text-sm ${tone}`}>{status.label}</p>;
}

export function StaleNote({ cafe }: { cafe: Cafe }) {
  if (cafe.is_fresh !== false) return null;
  return <p className="text-xs text-amber-700 dark:text-amber-400">Info may be outdated</p>;
}

export function MapsButton({ cafe }: { cafe: Cafe }) {
  if (!cafe.google_maps_uri) return null;
  return (
    <a
      href={cafe.google_maps_uri}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      Open in Google Maps
      <ExternalLink size={14} aria-hidden />
    </a>
  );
}

export function CafeCard({ cafe, status }: { cafe: Cafe; status: OpenStatus | null }) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug">{cafe.name}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{cafe.neighborhood}</p>
        </div>
        <PriceLevel level={cafe.price_level} />
      </div>
      <div className="flex gap-2">
        <TriIcon kind="restroom" value={cafe.restroom} />
        <TriIcon kind="dogs" value={cafe.allows_dogs} />
      </div>
      <div>
        <StatusText status={status} />
        <StaleNote cafe={cafe} />
      </div>
      <div className="mt-auto">
        <MapsButton cafe={cafe} />
      </div>
    </article>
  );
}
