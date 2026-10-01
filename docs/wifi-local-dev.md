# WiFi speed test: local development

The speed test needs a cafe within 75 m of you, so locally it runs against a seeded test cafe at coordinates
you choose. Nothing about that location is committed.

## 1. Local database
```bash
supabase start
supabase db reset          # applies all migrations to the local DB
```

## 2. Env (all gitignored)
`web/.env.local` points at production, so put local overrides in `web/.env.development.local`
(Next loads it ahead of `.env.local` in `next dev`):
```bash
# values from `supabase status -o env`
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Turnstile test keys: always pass (secret `2x0000000000000000000000000000000AA` always fails)
NEXT_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA

IPINFO_TOKEN=...                       # free ipinfo.io token (lite API)
SPEEDTEST_TOKEN_SECRET=$(openssl rand -hex 32)
IP_HASH_SALT=$(openssl rand -hex 32)
```
Put the test cafe's coordinates in `web/.env.local` (never in a committed file):
```bash
TEST_CAFE_LAT=...
TEST_CAFE_LNG=...
```

## 3. Seed the test cafe
```bash
cd web
npm run seed:test-cafe               # inserts "My Test Cafe" and prints its cafe_id
npm run seed:test-cafe -- --remove   # deletes it (its speed tests cascade)
```
The script refuses to run unless the Supabase URL is `localhost` / `127.0.0.1`. It takes the URL and key
from `supabase status`, not from the production values in `.env.local`.

## 4. Testing from a phone
Geolocation needs HTTPS, and a phone needs a reachable URL. Use a Cloudflare quick tunnel:
```bash
brew install cloudflared
npm run dev                                       # in web/
cloudflared tunnel --url http://localhost:3000    # prints https://<words>.trycloudflare.com
```
Open that URL on the phone. In `next dev` (and only there), `clientIp()` also reads `cf-connecting-ip`,
which the tunnel sets to the phone's real public IP. In production that header is ignored. The tunnel
hostname is allowed by `allowedDevOrigins` in `next.config.ts`. The test still needs the phone within
75 m of the seeded coordinates, on WiFi (not cellular), and not on Private Relay or a VPN.

## 5. Unit tests and curl
```bash
npm test                             # includes lib/speedtest/*.test.ts
```
Both routes can be exercised with curl; send `x-real-ip` to pick the client IP. Real-world checks are
listed in the field tests of `docs/wifi-spec.md`.
