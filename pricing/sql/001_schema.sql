-- iCOOL Pricing — schema pr (Supabase project icool-concept)
-- Browser holds only a session token; every read/write goes through public.pr_api.

create schema if not exists pr;

create table if not exists pr.settings (
  k text primary key,
  v jsonb not null
);

create table if not exists pr.sessions (
  token uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table if not exists pr.login_fails (
  at timestamptz not null default now()
);

-- Supplier purchase prices, synced from منصة يوميات iCOOL (pricelists/*) and other lists
create table if not exists pr.costs (
  id text primary key,                 -- supplier:code
  supplier text not null,
  supplier_name text,
  code text,
  item text not null,
  unit text,
  net_usd numeric,                     -- net unit cost after discount
  list_usd numeric,
  discount_pct numeric,
  last_date date,
  source text,                         -- invoice | oral | pricelist | wholesale
  ref text,                            -- invoice id / list name
  trade text,                          -- optional tag
  synced_at timestamptz not null default now()
);
create index if not exists costs_item_idx on pr.costs using gin (to_tsvector('simple', coalesce(item,'') || ' ' || coalesce(code,'')));

-- Standard BOQ items (all trades). Suggestion = history → supplier cost × markup + install → estimate.
create table if not exists pr.catalog (
  key text primary key,
  trade text not null,                 -- hvac | solar | elec | plumb | heat | mep
  name text not null,                  -- BOQ description (EN)
  name_ar text,
  unit text not null,
  cost_ids text[] not null default '{}',-- links to pr.costs (latest one wins)
  cost_usd numeric,                    -- manual material cost when no linked cost
  cost_note text,
  install_usd numeric not null default 0,
  markup_pct numeric,                  -- null → trade default from settings
  est_rate numeric,                    -- fallback client rate (supply + install)
  note text,
  updated_at timestamptz not null default now()
);

create table if not exists pr.projects (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  client text,
  site text,
  trade text,
  status text not null default 'draft', -- draft | sent | won | lost
  drawing_ref text unique,             -- set by the shop-drawings exporter
  validity_days int not null default 15,
  vat boolean not null default true,
  discount_pct numeric not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pr.lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references pr.projects(id) on delete cascade,
  pos int not null default 0,
  section text,
  catalog_key text references pr.catalog(key) on update cascade on delete set null,
  cost_id text,                        -- direct supplier item (when no catalog key)
  description text not null,
  unit text,
  qty numeric,
  qty_note text,                       -- e.g. TBC
  cost_usd numeric,                    -- unit cost used
  suggested numeric,
  suggest_src text,                    -- history | supplier | cost | estimate | none
  suggest_note text,
  rate numeric,
  status text not null default 'suggested', -- suggested | confirmed | tbc
  note text,
  updated_at timestamptz not null default now()
);
create index if not exists lines_project_idx on pr.lines(project_id, pos);

-- Confirmed client rates: the library that makes the next quote faster
create table if not exists pr.rates (
  id bigserial primary key,
  catalog_key text,
  description text,
  unit text,
  rate numeric not null,
  cost_usd numeric,
  project_id uuid references pr.projects(id) on delete set null,
  at date not null default current_date
);
create index if not exists rates_key_idx on pr.rates(catalog_key, at desc);

alter table pr.settings enable row level security;
alter table pr.sessions enable row level security;
alter table pr.login_fails enable row level security;
alter table pr.costs enable row level security;
alter table pr.catalog enable row level security;
alter table pr.projects enable row level security;
alter table pr.lines enable row level security;
alter table pr.rates enable row level security;

revoke all on schema pr from anon, authenticated;

insert into pr.settings(k, v) values
  ('markup', '{"hvac":0.10,"solar":0.10,"elec":0.15,"plumb":0.15,"heat":0.12,"mep":0.12}'),
  ('vat', '0.11'),
  ('history_days', '180')
on conflict (k) do nothing;
