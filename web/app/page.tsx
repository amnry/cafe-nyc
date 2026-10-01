import { MONO_LABEL } from "@/components/bits";
import { SourceNote } from "@/components/SourceNote";
import { CafeBrowser } from "@/components/CafeBrowser";
import { LiveStatus } from "@/components/LiveStatus";
import { getCafes } from "@/lib/cafes";

export const revalidate = 3600;

export default async function Home() {
  const { cafes, fetchedAt } = await getCafes();
  return (
    <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <LiveStatus />
        <h1 className="mt-2 font-display text-5xl leading-none font-bold tracking-wide uppercase sm:text-6xl">
          Find your 3rd place
        </h1>
        <p className="mt-2 text-sm text-muted">not home, not the office, scouted cafes in NYC</p>
      </header>
      <CafeBrowser
        cafes={cafes}
        renderedAt={fetchedAt}
        mapsKey={process.env.NEXT_GOOGLE_MAPS_API_KEY ?? null}
        turnstileSiteKey={process.env.NEXT_TURNSTILE_SITE_KEY ?? null}
      />
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
