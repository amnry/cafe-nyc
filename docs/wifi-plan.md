# WiFi speed test: implementation plan

Maps docs/wifi-spec.md (source of truth) onto this codebase. All flags A–K are ruled; rulings are merged
below and listed at the end. Execution: one phase at a time, commit after each, stop for review.

## Phases
0. **ETL schedule** (done, `66215a9`): `.github/workflows/etl.yml`.
1. **Schema**: migration + pgTAP RLS test.
2. **Server routes + unit tests**.
3. **Drawer UI**.
4. **Aggregation + card badge + near-me banner**.
5. **Deploy** + field tests.

## Patterns followed
- No supabase-js: raw `fetch` to PostgREST (`web/lib/cafes.ts`); server writes use the service-role key the same way.
- Route handlers are thin, return `Response.json`, missing env gives 500 (`web/app/api/revalidate/route.ts`).
- Pure logic in `web/lib/*.ts` with sibling `*.test.ts` (vitest).
- Migrations in `supabase/migrations/<ts>_<name>.sql`; view changes use `create or replace view cafes_public`, old columns first and in order, new ones appended.
- `web/lib/distance.ts#distanceMeters` for the geofence and banner. `web/lib/cafes.ts#CAFE_COLUMNS` is an explicit whitelist; wifi columns are added to it (laptop/prices stay banned in `cafes.test.ts`).

## Test timing (15-second test)
Config lives in `web/lib/speedtest/client-config.ts` (Phase 3). Option names checked against the
@cloudflare/speedtest 1.14.1 README.
```ts
{
  autoStart: false,
  measurements: [
    { type: "latency", numPackets: 10 },
    { type: "download", bytes: 1e5, count: 1, bypassMinDuration: true },
    { type: "download", bytes: 1e6, count: 4 },
    { type: "download", bytes: 1e7, count: 3 },
    { type: "download", bytes: 2.5e7, count: 1 },
    { type: "upload", bytes: 1e5, count: 2, bypassMinDuration: true },
    { type: "upload", bytes: 1e6, count: 4 },
    { type: "upload", bytes: 5e6, count: 2 },
  ],
  bandwidthFinishRequestDuration: 1000, // library default; fast networks still step up to larger files
  measureDownloadLoadedLatency: false,  // no loaded-latency measurements
  measureUploadLoadedLatency: false,
}
```
- No `packetLoss` measurement (needs a TURN server; not needed).
- Summary fields: `getSummary()` gives `download` / `upload` in **bps** (client converts to Mbps), `latency` and `jitter` in ms. `getTotalDurationMs()` gives the run time.
- Submit elapsed-time bound stays **5 to 120 s** (spec updated). Token still expires 5 minutes after issue.
- UI: progress bar sized for ~15 s plus the live download number while running (from `onResultsChange` / `results.getSummary().download`).
- Dev: log actual duration (`getTotalDurationMs()`) to the console when `NODE_ENV=development`. If a normal connection runs over ~18 s, tune the sequence (count first, then drop the 25 MB download).

## Local development (no real cafe address in git)
- `web/scripts/seed-test-cafe.mjs` (npm script `seed:test-cafe`): inserts one cafe, "My Test Cafe", `google_place_id = 'local-test-cafe'`, at `TEST_CAFE_LAT` / `TEST_CAFE_LNG` from `web/.env.local` (gitignored). `--remove` deletes it (speed tests cascade). It refuses to run unless the Supabase URL is `localhost` / `127.0.0.1` (URL and service-role key come from `supabase status`, never from the production values in `.env.local`).
- `clientIp()` also reads `cf-connecting-ip`, only when `NODE_ENV=development`, so a Cloudflare tunnel (`cloudflared tunnel --url localhost:3000`) gives a real client IP for phone testing. In production that header is ignored.
- Turnstile test keys locally. Steps are documented in `docs/wifi-local-dev.md`.

## Phase 1: schema
- `supabase/migrations/20261002120000_speed_tests.sql`: `speed_test_starts`, `speed_tests`, indexes, RLS on, `revoke all` from anon/authenticated, `speedtest_known_asn(uuid)`.
- `supabase/tests/speed_tests_rls.test.sql` (pgTAP): anon/authenticated cannot select or insert; service_role can; `speedtest_known_asn` callable by service_role only.

```sql
create table speed_test_starts (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafes(id) on delete cascade,
  created_at timestamptz not null default now(),
  ip_prefix_hash text not null,
  device_id_hash text not null,
  asn int,
  distance_m real,
  accuracy_m real,
  status text not null check (status in ('issued','rejected')),
  reject_reason text,
  nonce text unique,
  check ((status = 'rejected') = (reject_reason is not null))
);
create index on speed_test_starts (cafe_id, ip_prefix_hash, created_at);
create index on speed_test_starts (device_id_hash, created_at);

create table speed_tests (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafes(id) on delete cascade,
  created_at timestamptz not null default now(),
  test_day date not null default (now() at time zone 'America/New_York')::date,
  down_mbps real, up_mbps real, latency_ms real, jitter_ms real, -- null when rejected before measuring
  ip_prefix_hash text not null,
  asn int,
  asn_org text,
  distance_m real,
  accuracy_m real,
  device_id_hash text,
  status text not null check (status in ('accepted','flagged','rejected')),
  reject_reason text,
  nonce text unique,
  check ((status = 'rejected') = (reject_reason is not null))
);
create index on speed_tests (cafe_id, status, test_day);

alter table speed_test_starts enable row level security;
alter table speed_tests enable row level security;
revoke all on speed_test_starts, speed_tests from anon, authenticated;

-- Known network: ASN with >= 3 accepted tests on distinct days.
create function speedtest_known_asn(p_cafe uuid) returns int
language sql stable as $$
  select asn from speed_tests
  where cafe_id = p_cafe and status = 'accepted' and asn is not null
  group by asn having count(distinct test_day) >= 3
  order by count(distinct test_day) desc, max(created_at) desc limit 1
$$;
revoke execute on function speedtest_known_asn(uuid) from public, anon, authenticated;
grant execute on function speedtest_known_asn(uuid) to service_role;
```

## Phase 2: server routes + unit tests (`web/lib/speedtest/`, server-only; add `server-only` dep)
| File | Contents |
|---|---|
| `ip.ts` | `clientIp(headers, {dev})` (x-real-ip, then first x-forwarded-for; `cf-connecting-ip` first only when `dev`), `ipPrefix(ip)` (/24 v4, /48 v6, v4-mapped v6 as v4), `hmacHex`, `prefixHash`, `deviceHash` (IP_HASH_SALT) |
| `geofence.ts` | reject if accuracy > 300 (`low_accuracy`); pass if `d - min(acc,100) <= 75`, else `too_far` |
| `asn-config.ts` | `MOBILE_ASNS`, `HOSTING_VPN_ASNS`: `{asn, name, source}`; **every entry has a PeeringDB or bgp.he.net URL**. Comment: T-Mobile Home Internet shares T-Mobile's AS, a known false negative (that cafe cannot be tested) |
| `asn.ts` | `classifyAsn` gives `ok`, `mobile_network` or `vpn_or_hosting` |
| `private-relay.ts` | IP vs Apple's published egress ranges; snapshot CIDRs in `data/` built by `web/scripts/update-relay-ranges.ts` from https://mask-api.icloud.com/egress-ip-ranges.csv (too big to fetch per request). Reason `private_relay`: "Turn off Private Relay for this site, or use Chrome." |
| `ipinfo.ts` | `lookupAsn(ip)`: ipinfo lite API, 3 s timeout, failure gives `asn_lookup_failed` |
| `turnstile.ts` | `verifyTurnstile(token, ip)` |
| `token.ts` | `signSession` / `verifySession`: `base64url(json).base64url(hmac-sha256)`, `timingSafeEqual`, 5 min exp; payload `{cafe_id, ip_prefix_hash, asn, asn_org, issued_at, nonce}` plus `device_id_hash`, `distance_m`, `accuracy_m` (signed, so /submit needs no extra DB read to store them) |
| `bounds.ts` | elapsed **5–120 s**, down/up 0.1–2000, latency 1–2000, jitter >= 0 |
| `db.ts` | service-role PostgREST helpers behind a `Db` interface: `getCafe`, `countIssuedStarts`, `insertStart`, `insertTest` (409 gives nonce conflict), `knownAsn` rpc |
| `start.ts`, `submit.ts` | `handleStart(request, deps)` / `handleSubmit(request, deps)`: all logic, with injected `db`, `fetch`, `now`, env. Route files only wire real deps (`deps.ts`) |
| `reasons.ts` | shared `RejectReason` union + plain-English text (also used by the drawer) |

- `web/app/api/speedtest/start/route.ts` order: Turnstile, **Private Relay**, geofence, ASN lookup + classify, rate limits, issue token. Rate limits: **10 issued starts per (cafe, ip_prefix) per hour**, 10 per device_id per day (count `speed_test_starts.status='issued'`). Start rejects are written to `speed_test_starts` (except Turnstile failures, so bots cannot fill the table).
- `web/app/api/speedtest/submit/route.ts`: signature + expiry, nonce unused, **IP prefix hash matches OR asn matches the token**, elapsed + bounds. accepted / flagged / rejected per spec (rejects stored with reason). On accepted: `revalidateTag(CAFES_TAG, {expire: 0})`.
- Submit stores a rejected row for every failed check once the token signature is valid (a replayed nonce is stored with a null nonce, since the column is unique). The client only sees `{status:"ok"}` for accepted and flagged alike.
- Both: `export const runtime = "nodejs"`; rejects return `{status:"rejected", reason}` with 4xx.
- `web/vitest.config.mts` (new): `@` alias and a stub for `server-only`.
- Tests: `ip`, `geofence`, `asn`, `private-relay`, `token` (sign/verify/tamper/expiry), `bounds` (5 / 120 edges), `routes` (mocked fetch: nonce reuse, check order, accepted vs flagged, prefix-or-ASN match).

## Phase 3: drawer UI
- `web/lib/speedtest/client-config.ts`: the 15 s measurement config above.
- `web/components/WifiTest.tsx`: states idle, locating, prechecking, running (~15 s progress bar + live download number), result, thanks, error(reason). Own high-accuracy geolocation call (not `useGeolocation`). Turnstile + `@cloudflare/speedtest` dynamically imported on tap. "Be the first to test" shown when untested.
- `web/lib/useDeviceId.ts`: UUID in localStorage with in-memory fallback.
- `web/components/DetailDrawer.tsx`: WiFi Fact + WifiTest + disclosure line (CLAUDE.md wording).
- Before shipping: check Cloudflare terms for embedding / using speed.cloudflare.com (library is MIT).

## Phase 4: aggregation + card badge
- `supabase/migrations/20261003120000_wifi_aggregate.sql`: `cafe_wifi_stats` (no anon grant) + `create or replace view cafes_public` with wifi_* columns appended.
  - Daily sample = median of accepted tests per (cafe, ip_prefix_hash, test_day) (a 50-test flood in a day collapses to one).
  - Per cafe over 90 days: median of daily samples for down / up / latency; **`wifi_sample_days = count(distinct test_day)`**; `wifi_last_tested_at`.
- `supabase/tests/wifi_aggregate.test.sql` (pgTAP fixtures: flood of 50 to one sample; flagged/rejected excluded; 91 days old excluded; distinct-day count across prefixes).
- `web/lib/types.ts`, `CAFE_COLUMNS`, `web/lib/wifi.ts` + test (`wifiLabel`: "↓ 85 ↑ 20 Mbps · 4 days", "early data" under 3 days, "WiFi untested").
- `CafeCard.tsx`: WiFi row; untested is small, muted, **no call to action**. WiFi does not touch `ranking.ts`/`completeness`.
- `CafeBrowser.tsx`: near-me banner when `geo.origin` is within 75 m of a cafe: "Looks like you're at X. Test the WiFi?" Distance computed client-side; nothing is sent until the user taps Test.

## Phase 5: deploy
`supabase db push`; Vercel env (Production + Preview): `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, `IPINFO_TOKEN`, `SPEEDTEST_TOKEN_SECRET`, `IP_HASH_SALT`, `NEXT_TURNSTILE_SITE_KEY` (not `NEXT_PUBLIC_`: Vercel refused that name, so `page.tsx` reads it on the server and passes it down as a prop, like `NEXT_GOOGLE_MAPS_API_KEY`); Turnstile hostnames 3rdplacenyc.com, cafe-nyc.vercel.app and the preview hostname. Outside development, siteverify must also return action `speedtest` and the hostname that is calling us. Field tests: cafe WiFi = accepted; cellular = `mobile_network`; 500 m away = `too_far`.

## Verification
- Each phase: `npm test`, `npm run lint`, `npm run build` in `web/`.
- Phases 1 and 4: `supabase start`, `supabase db reset`, `supabase test db`.
- Phase 2: curl both routes with Turnstile test keys (`1x0000000000000000000000000000000AA` passes, `2x0000000000000000000000000000000AA` fails).
- Phase 3: run the app and click every drawer state with geolocation spoofed.

## Rulings (A–K)
- **A** Location: sent once to /api/speedtest/start on tap, geofence only, discarded; only distance_m / accuracy_m stored. Near-me stays client-only. (CLAUDE.md updated.)
- **B** WiFi in scope; card change approved; WiFi does not affect ranking.
- **C** Disclosure: "We store the speeds, the distance from the cafe, and your network provider. Your location and IP address are not stored."
- **D** 10 issued starts per (cafe, ip_prefix) per hour; 10 per device per day.
- **E** `speed_test_starts` approved.
- **F** Submit accepts if ip_prefix matches OR asn matches the token.
- **G** Private Relay detected via Apple egress ranges, reason `private_relay`; every ASN has a PeeringDB / bgp.he.net source URL; T-Mobile Home Internet noted as a known false negative.
- **H** `wifi_sample_days = count(distinct test_day)`; label "days".
- **I** Results are client-reported; acknowledged, no change.
- **J** Card: tested "↓ 85 ↑ 20 Mbps · 4 days" ("early data" under 3 days); untested small muted "WiFi untested", no CTA. "Be the first to test" in the drawer; near-me banner is the main CTA.
- **K** `revalidateTag` on accepted submits.
- **Bug fix** `grant execute on function speedtest_known_asn(uuid) to service_role;` (included in Phase 1 SQL).
