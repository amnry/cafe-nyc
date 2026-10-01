-- WiFi speed test storage (spec: docs/wifi-spec.md). Writes only via the service role from the API;
-- no anon/authenticated access. Never stores a raw IP or user coordinates (hashes, distance_m, accuracy_m only).

-- Every /start attempt that got past Turnstile. Rate limits count 'issued' rows here, since an
-- abandoned start never produces a speed_tests row.
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

-- Every /submit outcome, rejected ones included (with the reason).
create table speed_tests (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafes(id) on delete cascade,
  created_at timestamptz not null default now(),
  test_day date not null default (now() at time zone 'America/New_York')::date,
  down_mbps real,
  up_mbps real,
  latency_ms real,
  jitter_ms real,
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

-- Known network = the ASN with 3 or more accepted tests on distinct days (most days wins).
create function speedtest_known_asn(p_cafe uuid) returns int
language sql stable as $$
  select asn from speed_tests
  where cafe_id = p_cafe and status = 'accepted' and asn is not null
  group by asn
  having count(distinct test_day) >= 3
  order by count(distinct test_day) desc, max(created_at) desc
  limit 1
$$;
-- Revoking from public also removes service_role's access, so grant it back explicitly.
revoke execute on function speedtest_known_asn(uuid) from public, anon, authenticated;
grant execute on function speedtest_known_asn(uuid) to service_role;
