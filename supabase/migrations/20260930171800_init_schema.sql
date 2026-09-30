-- v1 schema: cafes, menu_prices, etl_runs, cafes_public view, RLS.

create function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table cafes (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique not null,
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  address text,
  lat double precision,
  lng double precision,
  neighborhood text not null,
  website text,
  google_maps_uri text,
  rating numeric(2,1) check (rating between 0 and 5),
  rating_count int check (rating_count >= 0),
  price_level smallint check (price_level between 0 and 4),
  business_status text check (business_status in ('OPERATIONAL','CLOSED_TEMPORARILY','CLOSED_PERMANENTLY')),
  opening_hours jsonb,
  restroom boolean,
  allows_dogs boolean,
  outdoor_seating boolean,
  reservable boolean,
  serves_wine boolean,
  serves_food boolean,
  ai_summary text,
  -- frontend shows Google's "Summarized with Gemini" label off this field
  ai_summary_source text check (ai_summary_source in ('generative','editorial','haiku')),
  laptop text not null default 'unknown' check (laptop in ('yes','no','unknown')),
  laptop_evidence text,
  laptop_confidence real check (laptop_confidence between 0 and 1),
  laptop_override text check (laptop_override in ('yes','no','unknown')),
  google_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger cafes_set_updated_at
  before update on cafes
  for each row execute function set_updated_at();

create table menu_prices (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references cafes(id) on delete cascade,
  item text not null check (item in ('latte','americano','cappuccino','matcha','drip')),
  price_cents int not null check (price_cents > 0),
  source_url text,
  observed_at timestamptz not null default now(),
  unique (cafe_id, item)
);

create table etl_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  cafes_processed int not null default 0,
  errors jsonb not null default '[]'
);

-- Intentionally NOT security_invoker: runs as owner so anon can read the view
-- while base tables stay locked. Exposes whitelisted columns only; read-only.
create view cafes_public as
select
  c.id, c.slug, c.name, c.address, c.lat, c.lng, c.neighborhood, c.website,
  c.google_maps_uri, c.rating, c.rating_count, c.price_level, c.business_status,
  c.opening_hours, c.restroom, c.allows_dogs, c.outdoor_seating, c.reservable,
  c.serves_wine, c.serves_food, c.ai_summary, c.ai_summary_source,
  coalesce(c.laptop_override, c.laptop) as laptop,
  p.latte_price_cents,
  coalesce(p.prices, '{}'::jsonb) as prices,
  c.google_refreshed_at,
  (c.google_refreshed_at >= now() - interval '30 days') as is_fresh
from cafes c
left join lateral (
  select
    max(price_cents) filter (where item = 'latte') as latte_price_cents,
    jsonb_object_agg(item, price_cents) as prices
  from menu_prices m
  where m.cafe_id = c.id
) p on true
where c.business_status is distinct from 'CLOSED_PERMANENTLY'
  and c.business_status is distinct from 'CLOSED_TEMPORARILY';

alter table cafes enable row level security;
alter table menu_prices enable row level security;
alter table etl_runs enable row level security;

revoke all on cafes, menu_prices, etl_runs from anon, authenticated;
grant select on cafes_public to anon, authenticated;
