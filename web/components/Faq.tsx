import type { ReactNode } from "react";
import { MONO_LABEL } from "./bits";
import { OpenFaqOnHash } from "./OpenFaqOnHash";

/**
 * Plain-language answers about the WiFi test and where the data comes from. Written for visitors,
 * not engineers: keep every claim true to docs/wifi-spec.md and CLAUDE.md if either changes.
 */
function XLink({ handle }: { handle: string }) {
  return (
    <a
      href={`https://x.com/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground underline decoration-1 underline-offset-4 hover:decoration-2"
    >
      x.com/{handle}
    </a>
  );
}

const QUESTIONS: { id?: string; q: string; a: ReactNode }[] = [
  {
    id: "faq-wifi",
    q: "Where do the WiFi speeds come from?",
    a: "From people working at these cafes. Anyone at a cafe can tap Test, and we show the typical speed from the last 90 days, so one slow afternoon doesn't define a cafe.",
  },
  {
    q: "What do you keep when I run a test?",
    a: "The speeds, roughly how far you were from the cafe, and the name of your internet provider. Your exact location and IP address are never stored, and there's no account or sign-up. We also keep a scrambled code (not your IP) that only lets us spot repeat tests.",
  },
  {
    q: "Does the test run on my device?",
    a: "Yes. It runs in your browser, only when you tap Test, and stops when it's done. It measures speed by loading sample files from Cloudflare's speed test network. Nothing runs in the background.",
  },
  {
    q: "How do you know the results are real?",
    a: "Every test is verified before it counts: you have to be at the cafe and on its WiFi. Results that don't add up are left out, which makes a cafe's score very hard to game.",
  },
  {
    q: "Why do you ask for my location?",
    a: "Only to confirm you're at the cafe when you run a test. It's checked once and then discarded. The \"Near me\" sort never sends your location anywhere; it stays on your device.",
  },
  {
    q: "Where does the cafe information come from?",
    a: "Names, addresses, ratings, hours, and details like restrooms, dogs, and outdoor seating come from Google Maps. Descriptions are Google's own. We refresh everything about every 3-4 weeks and mark anything older as possibly outdated.",
  },
  {
    q: "How do you choose which cafes to list?",
    a: "We start with every place Google Maps lists as a cafe or coffee shop in the neighborhoods we cover, then leave out places with fewer than 5 Google reviews, places with no posted hours, and spots inside buildings that need special access.",
  },
  {
    q: "Why isn't a cafe listed?",
    a: (
      <>
        To keep the list useful, I&apos;ve hidden places with no opening hours, fewer than 5 Google reviews, and
        spots inside buildings that need special access. If I&apos;ve missed somewhere great, correct me on{" "}
        <XLink handle="amnryx" />.
      </>
    ),
  },
  {
    q: "I own a cafe and something's wrong. How do I fix it?",
    a: (
      <>
        The data comes from Google Maps and refreshes about every 3-4 weeks. Update your Google Business
        Profile (hours, details, photos) and the change appears here at the next refresh. For anything else, DM me on{" "}
        <XLink handle="amnryx" />.
      </>
    ),
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mt-14 scroll-mt-6">
      <OpenFaqOnHash />
      <h2 id="faq-title" className="font-display text-3xl leading-none font-bold tracking-wide uppercase">
        FAQ
      </h2>
      <div className="mt-4 max-w-3xl divide-y divide-line border border-foreground/20 bg-surface">
        {QUESTIONS.map(({ id, q, a }) => (
          <details key={q} id={id} className="group scroll-mt-6 px-4 py-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground [&::-webkit-details-marker]:hidden">
              {q}
              <span className={`${MONO_LABEL} text-muted group-open:hidden`} aria-hidden>
                +
              </span>
              <span className={`${MONO_LABEL} hidden text-muted group-open:inline`} aria-hidden>
                −
              </span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-foreground/85">{a}</p>
          </details>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        Have any suggestions or complaints? DM me at{" "}
        <a
          href="https://x.com/amnryx"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline decoration-1 underline-offset-4 hover:decoration-2"
        >
          @amnryx
        </a>
        .
      </p>
    </section>
  );
}
