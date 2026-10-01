"use client";

import { ExternalLink, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { safeWebsite, summaryAttribution, visibleSummary } from "@/lib/drawer";
import { streetLine } from "@/lib/format";
import type { OpenStatus } from "@/lib/hours";
import type { Cafe, TriState } from "@/lib/types";
import { wifiSummary } from "@/lib/wifi";
import { MapsLink, MONO_LABEL, PriceLevel, Rating, StaleNote, StatusText, TriValue } from "./bits";
import { WifiTest } from "./WifiTest";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className={`${MONO_LABEL} text-muted`}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const tri = (v: TriState) => <TriValue value={v} />;

export function DetailDrawer({ cafe, status, onClose }: { cafe: Cafe; status: OpenStatus | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const summary = visibleSummary(cafe);
  const attribution = summaryAttribution(cafe.ai_summary_source);
  const site = safeWebsite(cafe.website);
  const address = streetLine(cafe.street_address, cafe.address);
  const wifi = wifiSummary(cafe);

  return (
    <dialog
      ref={ref}
      aria-labelledby="drawer-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close(); // click on the backdrop
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md border-l border-line bg-surface p-0 text-foreground backdrop:bg-foreground/50"
    >
      <div className="flex h-full flex-col overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="drawer-title" className="font-display text-3xl leading-none font-bold tracking-wide uppercase">
              {cafe.name}
            </h2>
            <p className={`${MONO_LABEL} mt-2 text-muted`}>
              {cafe.neighborhood}
              {address && <> · {address}</>}
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close details"
            className="-m-1 p-1 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Rating cafe={cafe} />
          <PriceLevel level={cafe.price_level} />
        </div>
        <div className="mt-2">
          <StatusText status={status} long />
        </div>
        <div className="mt-1">
          <StaleNote cafe={cafe} />
        </div>

        {summary && (
          <blockquote className="mt-5 border-l-2 border-accent bg-surface-2 px-3 py-2.5">
            <p className="leading-relaxed text-foreground/90 italic">{summary}</p>
          </blockquote>
        )}

        <dl className="mt-5 divide-y divide-line border-y border-line">
          <Fact label="Restroom">{tri(cafe.restroom)}</Fact>
          <Fact label="Dogs">{tri(cafe.allows_dogs)}</Fact>
          <Fact label="Outdoor">{tri(cafe.outdoor_seating)}</Fact>
          <Fact label="Wine">{tri(cafe.serves_wine)}</Fact>
          <Fact label="Reservable">{tri(cafe.reservable)}</Fact>
          <Fact label="WiFi">
            {wifi ? (
              <span className="text-right text-[13px] tabular-nums">
                {wifi}
                {cafe.wifi_latency_ms !== null && <> · {Math.round(cafe.wifi_latency_ms)} ms</>}
              </span>
            ) : (
              <span className="text-[13px] text-dim">Untested</span>
            )}
          </Fact>
          {site && (
            <Fact label="Website">
              <a
                href={site.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-foreground underline decoration-accent decoration-2 underline-offset-4"
              >
                {site.host}
                <ExternalLink size={12} aria-hidden />
              </a>
            </Fact>
          )}
        </dl>

        <WifiTest cafeId={cafe.id} untested={wifi === null} />

        <div className="mt-auto pt-6">
          <MapsLink cafe={cafe} />
          {attribution && <p className={`${MONO_LABEL} mt-4 text-[9px] text-dim`}>{attribution}</p>}
        </div>
      </div>
    </dialog>
  );
}
