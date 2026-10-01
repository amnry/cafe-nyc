begin;
select plan(16);

insert into cafes (id, google_place_id, slug, name, neighborhood)
values ('00000000-0000-0000-0000-0000000000c1', 'place-1', 'test-cafe', 'Test Cafe', 'West Village');

-- service_role (what the API uses) can write and read both tables.
set local role service_role;
select lives_ok(
  $$insert into speed_test_starts (cafe_id, ip_prefix_hash, device_id_hash, status, nonce)
    values ('00000000-0000-0000-0000-0000000000c1', 'h', 'd', 'issued', 'n-start')$$,
  'service_role can insert speed_test_starts');
select lives_ok(
  $$insert into speed_tests (cafe_id, ip_prefix_hash, asn, status, nonce, down_mbps)
    values ('00000000-0000-0000-0000-0000000000c1', 'h', 7018, 'accepted', 'n-1', 80)$$,
  'service_role can insert speed_tests');
select is((select count(*)::int from speed_tests), 1, 'service_role can read speed_tests');

-- constraints
select throws_ok(
  $$insert into speed_tests (cafe_id, ip_prefix_hash, status, nonce)
    values ('00000000-0000-0000-0000-0000000000c1', 'h', 'rejected', 'n-2')$$,
  '23514', null, 'rejected row needs a reject_reason');
select throws_ok(
  $$insert into speed_tests (cafe_id, ip_prefix_hash, status, nonce, reject_reason)
    values ('00000000-0000-0000-0000-0000000000c1', 'h', 'accepted', 'n-3', 'x')$$,
  '23514', null, 'accepted row cannot carry a reject_reason');
select throws_ok(
  $$insert into speed_tests (cafe_id, ip_prefix_hash, status, nonce, down_mbps)
    values ('00000000-0000-0000-0000-0000000000c1', 'h', 'accepted', 'n-1', 1)$$,
  '23505', null, 'nonce is unique');
select throws_ok(
  $$insert into speed_tests (cafe_id, ip_prefix_hash, status, nonce)
    values ('00000000-0000-0000-0000-0000000000c1', 'h', 'bogus', 'n-4')$$,
  '23514', null, 'status is constrained');

-- known network: needs >= 3 accepted tests on distinct days.
select is(speedtest_known_asn('00000000-0000-0000-0000-0000000000c1'), null, 'one test is not a known network');
insert into speed_tests (cafe_id, ip_prefix_hash, asn, status, nonce, test_day)
values ('00000000-0000-0000-0000-0000000000c1', 'h', 7018, 'accepted', 'n-5', current_date - 1),
       ('00000000-0000-0000-0000-0000000000c1', 'h', 7018, 'accepted', 'n-6', current_date - 2);
select is(speedtest_known_asn('00000000-0000-0000-0000-0000000000c1'), 7018, 'three distinct days make a known network');

-- anon / authenticated: no access to the tables or the function.
set local role anon;
select throws_ok($$select * from speed_tests$$, '42501', null, 'anon cannot select speed_tests');
select throws_ok($$select * from speed_test_starts$$, '42501', null, 'anon cannot select speed_test_starts');
select throws_ok(
  $$insert into speed_tests (cafe_id, ip_prefix_hash, status, reject_reason)
    values ('00000000-0000-0000-0000-0000000000c1', 'h', 'rejected', 'x')$$,
  '42501', null, 'anon cannot insert speed_tests');
select throws_ok(
  $$select speedtest_known_asn('00000000-0000-0000-0000-0000000000c1')$$,
  '42501', null, 'anon cannot call speedtest_known_asn');

set local role authenticated;
select throws_ok($$select * from speed_tests$$, '42501', null, 'authenticated cannot select speed_tests');
select throws_ok($$select * from speed_test_starts$$, '42501', null, 'authenticated cannot select speed_test_starts');
select throws_ok(
  $$select speedtest_known_asn('00000000-0000-0000-0000-0000000000c1')$$,
  '42501', null, 'authenticated cannot call speedtest_known_asn');

select * from finish();
rollback;
