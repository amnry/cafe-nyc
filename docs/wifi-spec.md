# WiFi speed test spec (v2 centerpiece)

## Goal
Visitors at a cafe run an in-browser speed test. Verified results build a
per-cafe WiFi rating. Verification is defense in depth: no single check is
trusted, and aggregation limits the damage of anything that slips through.

## Measurement
- @cloudflare/speedtest in the browser: download_mbps, upload_mbps,
  latency_ms, jitter_ms. Runs only on explicit user action.
- Check the library's terms for embedding before shipping.

## Server (Next.js route handlers on Vercel, nodejs runtime)
Client IP from Vercel's x-forwarded-for / x-real-ip headers.

### POST /api/speedtest/start
Input: cafe_id, turnstile_token, lat, lng, accuracy_m, device_id (random
UUID kept in localStorage).
Checks, in order, each with a machine-readable reject reason:
1. Turnstile token valid.
2. Geofence: distance(user, cafe) - min(accuracy_m, 100) <= 75 m.
   Reject if accuracy_m > 300.
3. ASN lookup (ipinfo lite API). Reject known US mobile carrier ASNs and
   hosting/VPN ASNs. Keep both lists in one config file, with a source
   comment for each ASN.
4. Rate limits: max 10 issued starts per (cafe, ip_prefix) per hour and
   10 per device_id per day.
On pass: return a session token = HMAC(SPEEDTEST_TOKEN_SECRET) over
{cafe_id, ip_prefix_hash, asn, issued_at, nonce}, expiring in 5 minutes.

### POST /api/speedtest/submit
Input: session_token, results.
Checks: valid signature and not expired; nonce unused; the current IP
prefix matches the token's, or the current ASN matches the token's; elapsed time 5 to 120 s (test runs ~15 s); plausible bounds
(down 0.1 to 2000, up 0.1 to 2000, latency 1 to 2000 ms).
Status:
- accepted: all checks pass and either the cafe has no known network yet
  or the ASN matches the cafe's known network.
- flagged: checks pass but the ASN differs from the cafe's known network.
- rejected: any check fails. Store rejected attempts too, with the reason.
Known network = the ASN with 3 or more accepted tests on distinct days.

## IP handling
ip_prefix = /24 for IPv4, /48 for IPv6.
ip_prefix_hash = HMAC(IP_HASH_SALT, ip_prefix). Never store the raw IP.
Never store the user's coordinates; store distance_m and accuracy_m only.

## Schema (new migration)
speed_tests: id uuid pk, cafe_id fk, created_at, test_day date
(America/New_York), down_mbps real, up_mbps real, latency_ms real,
jitter_ms real, ip_prefix_hash text, asn int, asn_org text,
distance_m real, accuracy_m real, device_id_hash text,
status text check in ('accepted','flagged','rejected'),
reject_reason text, nonce text unique.
RLS on, no anon access. Writes only via the service role from the API.

## Aggregation
Daily sample = median of accepted tests per (cafe_id, ip_prefix_hash,
test_day). Over the last 90 days, per cafe: median down, median up,
median latency, sample_days (count of daily samples), last_tested_at.
Expose these in cafes_public as wifi_down_mbps, wifi_up_mbps,
wifi_latency_ms, wifi_sample_days, wifi_last_tested_at.

## UI
- Card: "WiFi 85 Mbps · 4 days" or "WiFi untested · test it".
  If sample_days < 3, show "early data".
- Drawer: "Test this cafe's WiFi" button. States: ask for location,
  pre-check (show the reject reason in plain English), running with
  progress, result, thanks.
- If Near me detects the user within 75 m of a cafe, show a banner:
  "Looks like you're at X. Test the WiFi?"
- Disclosure line under the button: what's measured and stored, and
  that location and IP are not stored.

## Env vars (server only, never NEXT_PUBLIC)
SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY, IPINFO_TOKEN,
SPEEDTEST_TOKEN_SECRET, IP_HASH_SALT.
Site key (read on the server, passed to the page as a prop): NEXT_TURNSTILE_SITE_KEY.

## Tests
Unit: geofence math, ASN classification, token sign/verify/expiry,
nonce reuse, aggregation SQL against fixtures (including a flood of
50 tests in one day collapsing to one sample).
Field: at a real cafe, (1) on cafe WiFi: accepted, (2) on cellular:
rejected with reason mobile_network, (3) 500 m away: rejected with
reason too_far.