begin;
select plan(16);

-- Dates in the cafe's timezone, like the table default.
create temp table today as select (now() at time zone 'America/New_York')::date as d;
grant select on today to anon;

insert into cafes (id, google_place_id, slug, name, neighborhood) values
  ('00000000-0000-0000-0000-0000000000a1', 'p-a', 'cafe-a', 'Cafe A', 'West Village'),
  ('00000000-0000-0000-0000-0000000000a2', 'p-b', 'cafe-b', 'Cafe B', 'West Village'),
  ('00000000-0000-0000-0000-0000000000a3', 'p-c', 'cafe-c', 'Cafe C', 'West Village');

-- Cafe A
--  day -1, network p1: a flood of 50 tests (down 1..50, up 10, latency 20)  -> one daily sample, median 25.5
--  day -2, network p1: one test (down 100, up 30, latency 10)               -> daily sample 100
--  day -2, network p2: one test (down 200, up 50, latency 30)               -> daily sample 200
--  Daily samples [25.5, 100, 200] -> median 100; two distinct days. If the flood counted 50 times it would be ~25.
insert into speed_tests (cafe_id, ip_prefix_hash, status, nonce, test_day, down_mbps, up_mbps, latency_ms, created_at)
select '00000000-0000-0000-0000-0000000000a1', 'p1', 'accepted', 'flood-' || g, (select d from today) - 1, g, 10, 20, now() - interval '1 day'
from generate_series(1, 50) g;
insert into speed_tests (cafe_id, ip_prefix_hash, status, nonce, test_day, down_mbps, up_mbps, latency_ms, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'p1', 'accepted', 'a-2-p1', (select d from today) - 2, 100, 30, 10, now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a1', 'p2', 'accepted', 'a-2-p2', (select d from today) - 2, 200, 50, 30, now() - interval '2 days');
-- Never counted: flagged, rejected, and a 91-day-old accepted test.
insert into speed_tests (cafe_id, ip_prefix_hash, status, reject_reason, nonce, test_day, down_mbps, up_mbps, latency_ms, created_at) values
  ('00000000-0000-0000-0000-0000000000a1', 'p3', 'flagged',  null,        'flag-1', (select d from today),      9999, 9999, 1, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'p4', 'rejected', 'too_fast',  'rej-1',  (select d from today),      9999, 9999, 1, now()),
  ('00000000-0000-0000-0000-0000000000a1', 'p5', 'accepted', null,        'old-91', (select d from today) - 91, 5000, 5000, 1, now() - interval '91 days');

-- Cafe B: window edge. 89 days ago is the oldest day inside the 90-day window; 90 days ago is out.
insert into speed_tests (cafe_id, ip_prefix_hash, status, nonce, test_day, down_mbps, up_mbps, latency_ms, created_at) values
  ('00000000-0000-0000-0000-0000000000a2', 'p1', 'accepted', 'b-89', (select d from today) - 89, 40, 8, 25, now() - interval '89 days'),
  ('00000000-0000-0000-0000-0000000000a2', 'p1', 'accepted', 'b-90', (select d from today) - 90, 4000, 800, 1, now() - interval '90 days');

-- stats view
select is((select wifi_down_mbps from cafe_wifi_stats where cafe_id = '00000000-0000-0000-0000-0000000000a1'), 100.0, 'A: median of daily samples (flood collapses to one)');
select is((select wifi_up_mbps from cafe_wifi_stats where cafe_id = '00000000-0000-0000-0000-0000000000a1'), 30.0, 'A: median up');
select is((select wifi_latency_ms from cafe_wifi_stats where cafe_id = '00000000-0000-0000-0000-0000000000a1'), 20.0, 'A: median latency');
select is((select wifi_sample_days from cafe_wifi_stats where cafe_id = '00000000-0000-0000-0000-0000000000a1'), 2, 'A: distinct days (two networks on one day count once)');
select is((select wifi_last_tested_at from cafe_wifi_stats where cafe_id = '00000000-0000-0000-0000-0000000000a1')::date,
          (now() - interval '1 day')::date, 'A: last tested = newest accepted test (flagged and rejected ignored)');
select is((select wifi_down_mbps from cafe_wifi_stats where cafe_id = '00000000-0000-0000-0000-0000000000a2'), 40.0, 'B: 89 days old is in the window, 90 is out');
select is((select wifi_sample_days from cafe_wifi_stats where cafe_id = '00000000-0000-0000-0000-0000000000a2'), 1, 'B: one day');
select is((select count(*)::int from cafe_wifi_stats where cafe_id = '00000000-0000-0000-0000-0000000000a3'), 0, 'C: untested cafe has no stats row');

-- anon reads through cafes_public only
set local role anon;
select is((select wifi_down_mbps from cafes_public where id = '00000000-0000-0000-0000-0000000000a1'), 100.0, 'anon sees wifi_down_mbps in cafes_public');
select is((select wifi_sample_days from cafes_public where id = '00000000-0000-0000-0000-0000000000a1'), 2, 'anon sees wifi_sample_days');
select ok((select wifi_last_tested_at is not null from cafes_public where id = '00000000-0000-0000-0000-0000000000a1'), 'anon sees wifi_last_tested_at');
select is((select wifi_sample_days from cafes_public where id = '00000000-0000-0000-0000-0000000000a3'), 0, 'untested cafe: wifi_sample_days is 0 (not null)');
select is((select wifi_down_mbps from cafes_public where id = '00000000-0000-0000-0000-0000000000a3'), null, 'untested cafe: wifi_down_mbps is null');
select throws_ok($$select * from cafe_wifi_stats$$, '42501', null, 'anon cannot read cafe_wifi_stats directly');
select throws_ok($$select * from speed_tests$$, '42501', null, 'anon still cannot read speed_tests');
select is((select count(*)::int from cafes_public where id = '00000000-0000-0000-0000-0000000000a2'), 1, 'cafes_public still lists cafes (one row per cafe, no join fan-out)');

select * from finish();
rollback;
