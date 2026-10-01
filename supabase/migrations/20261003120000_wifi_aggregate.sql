-- WiFi aggregate per cafe (spec: docs/wifi-spec.md, rulings in docs/wifi-plan.md).
-- Daily sample = median of accepted tests per (cafe, ip_prefix_hash, test_day), so a flood of tests
-- from one network in one day counts once. Per cafe, over the last 90 days (America/New_York):
-- median of the daily samples, wifi_sample_days = count of distinct test days, last test time.
-- flagged and rejected tests never count.

create view cafe_wifi_stats as
with daily as (
  select
    cafe_id,
    ip_prefix_hash,
    test_day,
    percentile_cont(0.5) within group (order by down_mbps)  as down,
    percentile_cont(0.5) within group (order by up_mbps)    as up,
    percentile_cont(0.5) within group (order by latency_ms) as latency,
    max(created_at) as last_at
  from speed_tests
  where status = 'accepted'
    and test_day > (now() at time zone 'America/New_York')::date - 90
  group by cafe_id, ip_prefix_hash, test_day
)
select
  cafe_id,
  round((percentile_cont(0.5) within group (order by down))::numeric, 1)    as wifi_down_mbps,
  round((percentile_cont(0.5) within group (order by up))::numeric, 1)      as wifi_up_mbps,
  round((percentile_cont(0.5) within group (order by latency))::numeric, 1) as wifi_latency_ms,
  count(distinct test_day)::int                                             as wifi_sample_days,
  max(last_at)                                                              as wifi_last_tested_at
from daily
group by cafe_id;

-- Internal: read only through cafes_public (which runs as owner).
revoke all on cafe_wifi_stats from anon, authenticated;

-- Same columns as before in the same order (create or replace requires that), wifi_* appended.
create or replace view cafes_public as
select
  c.id, c.slug, c.name, c.address, c.lat, c.lng, c.neighborhood, c.website,
  c.google_maps_uri, c.rating, c.rating_count, c.price_level, c.business_status,
  c.opening_hours, c.restroom, c.allows_dogs, c.outdoor_seating, c.reservable,
  c.serves_wine, c.serves_food, c.ai_summary, c.ai_summary_source,
  coalesce(c.laptop_override, c.laptop) as laptop,
  p.latte_price_cents,
  coalesce(p.prices, '{}'::jsonb) as prices,
  c.google_refreshed_at,
  (c.google_refreshed_at >= now() - interval '30 days') as is_fresh,
  c.street_address,
  w.wifi_down_mbps,
  w.wifi_up_mbps,
  w.wifi_latency_ms,
  coalesce(w.wifi_sample_days, 0) as wifi_sample_days,
  w.wifi_last_tested_at
from cafes c
left join lateral (
  select
    max(price_cents) filter (where item = 'latte') as latte_price_cents,
    jsonb_object_agg(item, price_cents) as prices
  from menu_prices m
  where m.cafe_id = c.id
) p on true
left join cafe_wifi_stats w on w.cafe_id = c.id
where not c.hidden
  and c.business_status is distinct from 'CLOSED_PERMANENTLY'
  and c.business_status is distinct from 'CLOSED_TEMPORARILY';
