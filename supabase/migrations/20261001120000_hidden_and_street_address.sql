-- Data quality: exclusions and a clean street-address line.

alter table cafes
  add column hidden boolean not null default false,
  -- Why a row is hidden or shown. 'auto: ...' is set and cleared by the ETL;
  -- 'manual: ...' is set by hand and the ETL never overrides it (either direction).
  add column hidden_reason text,
  -- Street number + route from Places addressComponents, e.g. '204 W 10th St'.
  add column street_address text;

-- Same columns as before (create or replace requires that), plus street_address appended,
-- and hidden rows filtered out. Grants on the view are preserved.
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
  c.street_address
from cafes c
left join lateral (
  select
    max(price_cents) filter (where item = 'latte') as latte_price_cents,
    jsonb_object_agg(item, price_cents) as prices
  from menu_prices m
  where m.cafe_id = c.id
) p on true
where not c.hidden
  and c.business_status is distinct from 'CLOSED_PERMANENTLY'
  and c.business_status is distinct from 'CLOSED_TEMPORARILY';
