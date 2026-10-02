import { MONO_LABEL } from "./bits";

/**
 * Plain-language answers about the WiFi test and where the data comes from. Written for visitors,
 * not engineers: keep every claim true to docs/wifi-spec.md and CLAUDE.md if either changes.
 */
const QUESTIONS: { q: string; a: string }[] = [
  {
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
    a: "Every test is verified before it counts: you have to be at the cafe and on its WiFi. Results that don't add up are left out, so no one can game a cafe's score.",
  },
  {
    q: "Why do you ask for my location?",
    a: "Only to confirm you're at the cafe when you run a test. It's checked once and then discarded. The \"Near me\" sort never sends your location anywhere; it stays on your device.",
  },
  {
    q: "Where does the cafe information come from?",
    a: "Names, addresses, ratings, hours, and details like restrooms, dogs, and outdoor seating come from Google Maps. Descriptions are Google's own. We refresh everything every two weeks and mark anything older as possibly outdated.",
  },
  {
    q: "How do you choose which cafes to list?",
    a: "We start with every place Google Maps lists as a cafe or coffee shop in the neighborhoods we cover, then leave out members-only spaces, takeout-only counters, and places with too few reviews or no posted hours.",
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="mt-14 scroll-mt-6">
      <h2 id="faq-title" className="font-display text-3xl leading-none font-bold tracking-wide uppercase">
        FAQ
      </h2>
      <div className="mt-4 max-w-3xl divide-y divide-line border border-foreground/20 bg-surface">
        {QUESTIONS.map(({ q, a }) => (
          <details key={q} className="group px-4 py-3">
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
