"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { safeWebsite, summaryAttribution, triText } from "@/lib/drawer";
import type { OpenStatus } from "@/lib/hours";
import type { Cafe, TriState } from "@/lib/types";
import { MapsButton, PriceLevel, StaleNote, StatusText } from "./CafeCard";

function Fact({ label, value }: { label: string; value: TriState }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className={value === null ? "text-zinc-400 dark:text-zinc-500" : "font-medium"}>{triText(value)}</dd>
    </div>
  );
}

export function DetailDrawer({ cafe, status, onClose }: { cafe: Cafe; status: OpenStatus | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const attribution = summaryAttribution(cafe.ai_summary_source);
  const site = safeWebsite(cafe.website);

  return (
    <dialog
      ref={ref}
      aria-labelledby="drawer-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // click on the backdrop
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md border-l border-zinc-200 bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40 dark:border-zinc-800"
    >
      <div className="flex h-full flex-col overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-xl font-semibold leading-snug">{cafe.name}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{cafe.neighborhood}</p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close details"
            className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <PriceLevel level={cafe.price_level} />
          <StatusText status={status} />
        </div>
        <StaleNote cafe={cafe} />

        {cafe.ai_summary && (
          <section className="mt-5" aria-label="Summary">
            <p className="leading-relaxed">{cafe.ai_summary}</p>
            {attribution && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{attribution}</p>}
          </section>
        )}

        <dl className="mt-5 divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <Fact label="Outdoor seating" value={cafe.outdoor_seating} />
          <Fact label="Serves wine" value={cafe.serves_wine} />
          <Fact label="Reservable" value={cafe.reservable} />
          {site && (
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-zinc-600 dark:text-zinc-400">Website</dt>
              <dd>
                <a href={site.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2">
                  {site.host}
                  <ExternalLink size={12} aria-hidden />
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-auto pt-6">
          <MapsButton cafe={cafe} />
        </div>
      </div>
    </dialog>
  );
}
