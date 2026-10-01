import { CafeBrowser } from "@/components/CafeBrowser";
import { getCafes } from "@/lib/cafes";

export const revalidate = 3600;

export default async function Home() {
  const cafes = await getCafes();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Cafes for remote work</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          West Village and Greenwich Village, NYC. Filter, then open in Google Maps.
        </p>
      </header>
      <CafeBrowser cafes={cafes} />
      <footer className="mt-10 text-xs text-zinc-500 dark:text-zinc-400">
        Place data from Google Maps. Times shown in New York time.
      </footer>
    </main>
  );
}
