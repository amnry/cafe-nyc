// Inserts (or with --remove, deletes) one cafe, "Test Cafe (local)", in the LOCAL Supabase so the
// speed test can be tried without a real cafe. The coordinates come from TEST_CAFE_LAT and
// TEST_CAFE_LNG in web/.env.local (gitignored): no address is committed.
//
//   npm run seed:test-cafe              # insert / update
//   npm run seed:test-cafe -- --remove  # delete it (its speed tests cascade)
//
// Safety: refuses to run unless the Supabase URL is localhost / 127.0.0.1. The URL and service-role
// key come from `supabase status` (or SEED_SUPABASE_URL / SEED_SERVICE_ROLE_KEY), never from the
// NEXT_PUBLIC_SUPABASE_URL in .env.local, which points at production.
import { execFileSync } from "node:child_process";

const PLACE_ID = "local-test-cafe";
const remove = process.argv.includes("--remove");

function localSupabase() {
  if (process.env.SEED_SUPABASE_URL && process.env.SEED_SERVICE_ROLE_KEY) {
    return { url: process.env.SEED_SUPABASE_URL, key: process.env.SEED_SERVICE_ROLE_KEY };
  }
  let status;
  try {
    status = JSON.parse(execFileSync("supabase", ["status", "-o", "json"], { cwd: new URL("../../", import.meta.url), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    throw new Error("Could not read `supabase status`. Run `supabase start` first (or set SEED_SUPABASE_URL and SEED_SERVICE_ROLE_KEY).");
  }
  return { url: status.API_URL, key: status.SERVICE_ROLE_KEY };
}

const { url, key } = localSupabase();
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)) {
  console.error(`Refusing to run: Supabase URL host is "${host}", not localhost / 127.0.0.1.`);
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const rest = `${url.replace(/\/$/, "")}/rest/v1`;

if (remove) {
  const res = await fetch(`${rest}/cafes?google_place_id=eq.${PLACE_ID}`, { method: "DELETE", headers: { ...headers, Prefer: "return=representation" } });
  if (!res.ok) throw new Error(`delete failed: HTTP ${res.status} ${await res.text()}`);
  console.log(`removed ${(await res.json()).length} test cafe(s) from ${host}`);
} else {
  const lat = Number(process.env.TEST_CAFE_LAT);
  const lng = Number(process.env.TEST_CAFE_LNG);
  if (!process.env.TEST_CAFE_LAT || !process.env.TEST_CAFE_LNG || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    console.error("Set TEST_CAFE_LAT and TEST_CAFE_LNG (decimal degrees) in web/.env.local.");
    process.exit(1);
  }
  const row = {
    google_place_id: PLACE_ID,
    slug: "test-cafe-local",
    name: "Test Cafe (local)",
    neighborhood: "West Village",
    lat,
    lng,
    business_status: "OPERATIONAL",
    hidden: false,
    google_refreshed_at: new Date().toISOString(),
  };
  const res = await fetch(`${rest}/cafes?on_conflict=google_place_id`, { method: "POST", headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(row) });
  if (!res.ok) throw new Error(`insert failed: HTTP ${res.status} ${await res.text()}`);
  const [cafe] = await res.json();
  console.log(`seeded "${cafe.name}" on ${host}\n  cafe_id: ${cafe.id}`);
}
