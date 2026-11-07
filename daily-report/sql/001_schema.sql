-- iCOOL Daily Report — schema dr (tables not exposed to the API; all access through public.dr_* functions)
create schema if not exists dr;
create extension if not exists pgcrypto with schema extensions;

create table if not exists dr.users (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role text not null check (role in ('admin','foreman','worker')),
  pin_hash text not null,
  platform_name text,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists dr.sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references dr.users(id) on delete cascade,
  ticket uuid not null default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '45 days',
  created_at timestamptz not null default now()
);

create table if not exists dr.login_fails (
  user_id uuid,
  at timestamptz not null default now()
);

create table if not exists dr.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  area text,
  address text,
  lat double precision,
  lng double precision,
  map_url text,
  notes text,
  platform_name text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists dr.plans (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references dr.customers(id) on delete cascade,
  title text not null,
  kind text not null default 'maintenance',
  every_days int not null check (every_days > 0),
  next_date date not null,
  assignees uuid[] not null default '{}',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists dr.tasks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time text,
  customer_id uuid references dr.customers(id) on delete set null,
  title text not null,
  kind text not null default 'work',
  details text,
  assignees uuid[] not null default '{}',
  status text not null default 'planned' check (status in ('planned','in_progress','done','postponed','cancelled')),
  priority text not null default 'normal' check (priority in ('normal','urgent')),
  plan_id uuid references dr.plans(id) on delete set null,
  started_at timestamptz,
  done_at timestamptz,
  done_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tasks_date on dr.tasks(date);

create table if not exists dr.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references dr.users(id),
  date date not null,
  kind text not null default 'work' check (kind in ('before','after','work','invoice','fuel','payment','sheet','site')),
  path text not null,
  task_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists photos_date on dr.photos(date);

create table if not exists dr.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references dr.users(id),
  date date not null,
  task_id uuid references dr.tasks(id) on delete set null,
  customer_id uuid references dr.customers(id) on delete set null,
  site text,
  start_time text,
  end_time text,
  work text not null,
  photo_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reports_date on dr.reports(date);

create table if not exists dr.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references dr.users(id),
  date date not null,
  kind text not null check (kind in ('goods','fuel')),
  item text not null,
  qty text,
  amount numeric not null check (amount > 0),
  currency text not null default '$' check (currency in ('$','LL')),
  source text not null check (length(trim(source)) > 1),
  paid_by text,
  vehicle text,
  customer_id uuid references dr.customers(id) on delete set null,
  site text,
  photo_ids uuid[] not null check (cardinality(photo_ids) > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  created_at timestamptz not null default now()
);

create table if not exists dr.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references dr.users(id),
  date date not null,
  kind text not null check (kind in ('advance','customer_receipt','wage','other')),
  party text not null,
  amount numeric not null check (amount > 0),
  currency text not null default '$' check (currency in ('$','LL')),
  note text,
  photo_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists dr.daylogs (
  date date not null,
  foreman_id uuid not null references dr.users(id),
  mode text not null default 'paper' check (mode in ('paper','app')),
  sheet_photo_ids uuid[] not null default '{}',
  workers jsonb not null default '[]',
  materials jsonb not null default '[]',
  payments jsonb not null default '[]',
  notes text,
  closed boolean not null default false,
  closed_at timestamptz,
  synced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (date, foreman_id)
);

-- pushed from منصة يوميات iCOOL (computed from Maher's sheets)
create table if not exists dr.balances (
  name text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists dr.platform_days (
  date date primary key,
  workers jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create table if not exists dr.sync_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  info jsonb
);

alter table dr.users enable row level security;
alter table dr.sessions enable row level security;
alter table dr.login_fails enable row level security;
alter table dr.customers enable row level security;
alter table dr.plans enable row level security;
alter table dr.tasks enable row level security;
alter table dr.photos enable row level security;
alter table dr.reports enable row level security;
alter table dr.expenses enable row level security;
alter table dr.payments enable row level security;
alter table dr.daylogs enable row level security;
alter table dr.balances enable row level security;
alter table dr.platform_days enable row level security;
alter table dr.sync_log enable row level security;
revoke all on schema dr from anon, authenticated;
revoke all on all tables in schema dr from anon, authenticated;

-- photo storage: public read by unguessable path, upload only into a live session's ticket folder
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dr-photos','dr-photos', true, 3145728, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 3145728, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

create or replace function public.dr_ticket_ok(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from dr.sessions s join dr.users u on u.id = s.user_id
                 where s.ticket::text = t and s.expires_at > now() and u.active);
$$;
revoke all on function public.dr_ticket_ok(text) from public;
grant execute on function public.dr_ticket_ok(text) to anon, authenticated;

drop policy if exists dr_photos_insert on storage.objects;
create policy dr_photos_insert on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'dr-photos' and public.dr_ticket_ok((storage.foldername(name))[1]));
