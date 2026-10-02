import { afterEach, describe, expect, it, vi } from "vitest";
import { CAFE_COLUMNS, cafesUrl, getCafes, PAGE_ROWS } from "./cafes";

describe("cafes_public column list", () => {
  it("never reads out-of-scope columns", () => {
    for (const banned of ["laptop", "latte_price_cents", "prices", "laptop_override", "serves_food", "*"]) {
      expect(CAFE_COLUMNS).not.toContain(banned as never);
    }
  });

  it("builds an explicit select URL", () => {
    const url = cafesUrl("https://x.supabase.co/");
    expect(url).toMatch(/^https:\/\/x\.supabase\.co\/rest\/v1\/cafes_public\?select=/);
    expect(decodeURIComponent(url)).not.toMatch(/select=\*|laptop|latte_price|\bprices\b/);
  });

  it("orders by rating, then review count, unrated last", () => {
    expect(decodeURIComponent(cafesUrl("https://x.supabase.co"))).toContain(
      "order=rating.desc.nullslast,rating_count.desc.nullslast,name.asc",
    );
  });
});

describe("getCafes paging", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const row = (i: number) => ({ id: `id-${i}`, slug: `s-${i}`, name: `Cafe ${i}`, rating: 4, rating_count: 100, neighborhood: "SoHo" });

  it("pages past the 1000-row server cap and returns every cafe", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    const total = PAGE_ROWS + 75;
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      const offset = Number(new URL(url).searchParams.get("offset"));
      const rows = Array.from({ length: Math.min(PAGE_ROWS, total - offset) }, (_, i) => row(offset + i));
      return new Response(JSON.stringify(rows), { headers: { date: "Fri, 02 Oct 2026 12:00:00 GMT" } });
    });
    const { cafes } = await getCafes();
    expect(cafes).toHaveLength(total);
    expect(new Set(cafes.map((c) => c.id)).size).toBe(total);
    expect(urls.map((u) => new URL(u).searchParams.get("offset"))).toEqual(["0", String(PAGE_ROWS)]);
  });

  it("makes one request when the first page is not full", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([row(1)])));
    vi.stubGlobal("fetch", fetchMock);
    expect((await getCafes()).cafes).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
