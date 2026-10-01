import { MONO_LABEL } from "@/components/bits";
import { CafeBrowser } from "@/components/CafeBrowser";
import { getCafes } from "@/lib/cafes";

export const revalidate = 3600;

export default async function Home() {
  const cafes = await getCafes();
  return (
    <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <p className={`${MONO_LABEL} text-accent`}>West Village · Greenwich Village · NYC</p>
        <h1 className="mt-2 font-display text-5xl leading-none font-bold tracking-wide uppercase sm:text-6xl">
          Cafes for remote work
        </h1>
        <p className="mt-2 text-sm text-muted">Filter, scan, then open it in Google Maps.</p>
      </header>
      <CafeBrowser cafes={cafes} />
      <footer className="mt-12 border-t border-line pt-4">
        <p className={`${MONO_LABEL} text-muted`}>Built in/for NYC</p>
      </footer>
    </main>
  );
}
