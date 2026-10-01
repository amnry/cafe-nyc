import { getCafes } from "@/lib/cafes";

export const revalidate = 3600;

export default async function Home() {
  const cafes = await getCafes();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Cafes for remote work</h1>
      <p className="mt-1 text-sm text-zinc-600">{cafes.length} cafes in West Village and Greenwich Village</p>
      <ul className="mt-4 list-disc pl-5">
        {cafes.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>
    </main>
  );
}
