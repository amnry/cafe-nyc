import { MONO_LABEL } from "@/components/bits";
import { SourceNote } from "@/components/SourceNote";
import { CafeBrowser } from "@/components/CafeBrowser";
import { Faq } from "@/components/Faq";
import { LiveStatus } from "@/components/LiveStatus";
import { getCafes } from "@/lib/cafes";

export const revalidate = 3600;

export default async function Home() {
  const { cafes, fetchedAt } = await getCafes();
  return (
    <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <LiveStatus />
          <a
            href="#faq"
            className={`${MONO_LABEL} text-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground`}
          >
            FAQ
          </a>
        </div>
        <h1 className="mt-2 font-display text-5xl leading-none font-bold tracking-wide sm:text-6xl">
          Find your 3rd Place
        </h1>
        <p className="mt-2 text-sm text-muted">not home, not the office, scouted cafes in NYC</p>
        <p className="mt-1 text-sm text-muted">
          Real WiFi speeds, tested from the table. At a cafe?{" "}
          <a href="#faq-wifi" className="text-foreground underline decoration-1 underline-offset-4 hover:decoration-2">
            Test it
          </a>{" "}
          in 15 sec.
        </p>
      </header>
      <CafeBrowser
        cafes={cafes}
        renderedAt={fetchedAt}
        mapsKey={process.env.NEXT_GOOGLE_MAPS_API_KEY ?? null}
        turnstileSiteKey={process.env.NEXT_TURNSTILE_SITE_KEY ?? null}
      />
      <Faq />
      <footer className="mt-12 flex items-center gap-3 border-t border-line pt-4">
        <p className={`${MONO_LABEL} text-muted`}>
          Built in/for NYC <span aria-hidden>🗽</span>
        </p>
        <span className="text-muted" aria-hidden>
          ·
        </span>
        <SourceNote />
      </footer>
    </main>
  );
}
