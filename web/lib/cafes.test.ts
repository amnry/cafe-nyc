import { describe, expect, it } from "vitest";
import { CAFE_COLUMNS, cafesUrl } from "./cafes";

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
});
