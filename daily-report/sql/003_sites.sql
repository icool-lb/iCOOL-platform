-- iCOOL Daily Report — 003: one customer, many sites (Ahmad 24/11/2026: «اسم الزبون ثابت والموقع متغير»)
-- dr.customers = the person/company (name, phone, notes, platform_name).
-- dr.sites     = each place we work for him: label, area, address, GPS, Deye system, platform name for that site.
-- tasks / reports / expenses / plans get an optional site_id beside customer_id.
-- The location columns kept on dr.customers are legacy (copied into sites below); the app no longer edits them.

create table if not exists dr.sites (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references dr.customers(id) on delete cascade,
  label text not null,
  area text,
  address text,
  lat double precision,
  lng double precision,
  map_url text,
  deye_id bigint,
  platform_name text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sites_customer_idx on dr.sites(customer_id);
alter table dr.sites enable row level security;

alter table dr.tasks    add column if not exists site_id uuid references dr.sites(id) on delete set null;
alter table dr.reports  add column if not exists site_id uuid references dr.sites(id) on delete set null;
alter table dr.expenses add column if not exists site_id uuid references dr.sites(id) on delete set null;
alter table dr.plans    add column if not exists site_id uuid references dr.sites(id) on delete set null;
