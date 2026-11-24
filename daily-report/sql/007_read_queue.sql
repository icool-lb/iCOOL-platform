-- iCOOL Daily Report — 007: handwriting reading the same way منصة يوميات iCOOL does it (24/11/2026)
-- The platform reads sheets inside claude.ai (artifact `sample` capability = Claude on Ahmad's plan, no API key).
-- Daily Report can't call Claude from Vercel without a key, so: the app queues a read request; the claude.ai artifact
-- «قارئ أوراق iCOOL» (Ahmad's Supabase connector + Claude) picks it up, reads the photos, and writes the result back.
-- Photos for reading are also kept as base64 here, because the artifact can reach Supabase only through SQL.

create table if not exists dr.photo_data (
  photo_id uuid primary key references dr.photos(id) on delete cascade,
  b64 text not null,
  created_at timestamptz not null default now()
);
alter table dr.photo_data enable row level security;

create table if not exists dr.read_queue (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('site','daylog')),
  site_id uuid references dr.sites(id) on delete cascade,
  date date not null,
  photo_ids uuid[] not null,
  hint jsonb,
  status text not null default 'pending' check (status in ('pending','working','done','error')),
  result jsonb,
  error text,
  requested_by uuid references dr.users(id),
  created_at timestamptz not null default now(),
  picked_at timestamptz,
  done_at timestamptz
);
create index if not exists read_queue_status on dr.read_queue(status, created_at);
alter table dr.read_queue enable row level security;

create or replace function dr.read_api(me dr.users, p_action text, p jsonb, d date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare rid uuid; ids uuid[]; q dr.read_queue;
begin
  if p_action = 'photo_data' then
    if not exists (select 1 from dr.photos where id = (p->>'id')::uuid and user_id = me.id) then return '{"error":"bad","msg":"صورة مش إلك"}'; end if;
    if length(coalesce(p->>'b64', '')) < 100 or length(p->>'b64') > 3000000 then return '{"error":"bad","msg":"الصورة كبيرة"}'; end if;
    insert into dr.photo_data(photo_id, b64) values ((p->>'id')::uuid, regexp_replace(p->>'b64', '^data:[^,]*,', ''))
    on conflict (photo_id) do update set b64 = excluded.b64;
    return '{"ok":true}';

  elsif p_action = 'read_request' then
    select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p->'photo_ids', '[]'));
    if cardinality(ids) = 0 then return '{"error":"photos","msg":"صوّر الورقة أول"}'; end if;
    if exists (select 1 from unnest(ids) i where not exists (select 1 from dr.photo_data x where x.photo_id = i)) then
      return '{"error":"bad","msg":"الصورة لسّا ما خلصت تحميل — استنّى شوي وجرّب"}'; end if;
    if p->>'kind' = 'site' and not dr.can_site(me, (p->>'site_id')::uuid, d) then return '{"error":"forbidden"}'; end if;
    if p->>'kind' = 'daylog' and me.role not in ('admin','foreman') then return '{"error":"forbidden"}'; end if;
    select id into rid from dr.read_queue where kind = p->>'kind' and date = d and status in ('pending','working')
      and ((p->>'kind' = 'site' and site_id = (p->>'site_id')::uuid) or (p->>'kind' = 'daylog' and requested_by = me.id));
    if rid is not null then
      update dr.read_queue set photo_ids = ids, hint = p->'hint', status = 'pending', picked_at = null where id = rid;
    else
      insert into dr.read_queue(kind, site_id, date, photo_ids, hint, requested_by)
      values (p->>'kind', nullif(p->>'site_id', '')::uuid, d, ids, p->'hint', me.id) returning id into rid;
    end if;
    return jsonb_build_object('ok', true, 'id', rid, 'ahead', (select count(*) from dr.read_queue where status in ('pending','working') and created_at < (select created_at from dr.read_queue where id = rid)));

  elsif p_action = 'read_get' then
    select * into q from dr.read_queue where id = (p->>'id')::uuid;
    if q.id is null then return '{"error":"bad"}'; end if;
    return jsonb_build_object('status', q.status, 'result', q.result, 'error', q.error,
      'reader_seen', (select max(picked_at) from dr.read_queue) > now() - interval '3 minutes');
  end if;
  return null;
end $$;
revoke all on function dr.read_api(dr.users, text, jsonb, date) from public;

-- for the claude.ai reader (runs through Ahmad's Supabase connector, as the database owner)
create or replace function dr.reader_next() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q dr.read_queue;
begin
  select * into q from dr.read_queue
  where status = 'pending' or (status = 'working' and picked_at < now() - interval '6 minutes')
  order by created_at limit 1 for update skip locked;
  if q.id is null then return null; end if;
  update dr.read_queue set status = 'working', picked_at = now() where id = q.id;
  return jsonb_build_object('id', q.id, 'kind', q.kind, 'date', q.date, 'hint', q.hint,
    'by', (select name from dr.users where id = q.requested_by),
    'site', (select c.name || ' — ' || s.label from dr.sites s join dr.customers c on c.id = s.customer_id where s.id = q.site_id),
    'images', (select coalesce(jsonb_agg(x.b64 order by array_position(q.photo_ids, x.photo_id)), '[]') from dr.photo_data x where x.photo_id = any(q.photo_ids)),
    'pending', (select count(*) from dr.read_queue where status = 'pending'));
end $$;

create or replace function dr.reader_done(p_id uuid, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q dr.read_queue;
begin
  update dr.read_queue set status = 'done', result = p_result, error = null, done_at = now() where id = p_id returning * into q;
  if q.kind = 'site' then
    update dr.site_sheets set paper_read = p_result where site_id = q.site_id and date = q.date and paper_read is null;
  end if;
  return jsonb_build_object('ok', q.id is not null);
end $$;

create or replace function dr.reader_fail(p_id uuid, p_msg text) returns jsonb
language sql security definer set search_path = '' as $$
  update dr.read_queue set status = 'error', error = left(p_msg, 500), done_at = now() where id = p_id returning jsonb_build_object('ok', true);
$$;

create or replace function dr.reader_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('pending', (select count(*) from dr.read_queue where status = 'pending'),
    'recent', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]') from (
      select q.id, q.kind, q.date, q.status, q.error, q.created_at, q.done_at, u.name as by,
        (select c.name || ' — ' || s.label from dr.sites s join dr.customers c on c.id = s.customer_id where s.id = q.site_id) as site
      from dr.read_queue q left join dr.users u on u.id = q.requested_by order by q.created_at desc limit 15) x));
$$;
revoke all on function dr.reader_next() from public, anon, authenticated;
revoke all on function dr.reader_done(uuid, jsonb) from public, anon, authenticated;
revoke all on function dr.reader_fail(uuid, text) from public, anon, authenticated;
revoke all on function dr.reader_status() from public, anon, authenticated;
