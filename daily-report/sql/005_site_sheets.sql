-- iCOOL Daily Report — 005: site sheets (ورقة الموقع) + GPS arrival/leave + unified day sheet (Ahmad 24/11/2026)
-- • A worker presses «وصلت» / «طلعت» at a site: the server stamps the time; the phone's coordinates are stored once and
--   cannot be edited by the worker. Distance to the site's GPS is kept for the boss.
-- • One sheet per site per day, shared by the crew there: work done + photos, goods received / used / left (and where),
--   missing customer details. Expenses (fuel, repair, goods…) and payments carry site_id. Paper mode = photo of the printed form.
-- • The unified day sheet (الورقة الموحّدة) is built from all site sheets + visits of the day and can fill the foreman's daylog.

create table if not exists dr.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references dr.users(id),
  date date not null,
  site_id uuid not null references dr.sites(id) on delete cascade,
  task_id uuid references dr.tasks(id) on delete set null,
  arrive_at timestamptz not null default now(),
  arrive_lat double precision, arrive_lng double precision, arrive_acc double precision, arrive_dist_m double precision,
  leave_at timestamptz,
  leave_lat double precision, leave_lng double precision, leave_acc double precision, leave_dist_m double precision,
  created_at timestamptz not null default now()
);
create index if not exists visits_date on dr.visits(date);
create index if not exists visits_site on dr.visits(site_id, date);
alter table dr.visits enable row level security;

create table if not exists dr.site_sheets (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  site_id uuid not null references dr.sites(id) on delete cascade,
  mode text not null default 'app' check (mode in ('app','paper')),
  work text,
  work_photo_ids uuid[] not null default '{}',
  paper_photo_ids uuid[] not null default '{}',
  materials jsonb not null default '[]',   -- [{item, qty, unit, kind: received|used|left, place, source}]
  fixes jsonb not null default '{}',       -- {name, phone, address, note} proposed by the crew; applied by the admin
  fixes_applied boolean not null default false,
  notes text,
  closed boolean not null default false,
  closed_at timestamptz, closed_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (date, site_id)
);
alter table dr.site_sheets enable row level security;

alter table dr.sites add column if not exists gps_source text;          -- manual | arrival
alter table dr.payments add column if not exists site_id uuid references dr.sites(id) on delete set null;
alter table dr.expenses drop constraint if exists expenses_kind_check;
alter table dr.expenses add constraint expenses_kind_check check (kind in ('goods','fuel','repair','other'));

create or replace function dr.dist_m(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable as $$
  select case when lat1 is null or lat2 is null then null else
    round((6371000 * 2 * asin(sqrt(power(sin(radians(lat2 - lat1) / 2), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2))))::numeric, 0)::float8 end;
$$;

-- may the user work on this site's sheet today?
create or replace function dr.can_site(u dr.users, p_site uuid, p_date date) returns boolean
language sql stable security definer set search_path = '' as $$
  select u.role in ('admin','foreman')
    or exists (select 1 from dr.visits v where v.site_id = p_site and v.date = p_date and v.user_id = u.id)
    or exists (select 1 from dr.tasks t where t.site_id = p_site and t.date = p_date and u.id = any(t.assignees));
$$;

create or replace function dr.site_json(p_site uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(s) || jsonb_build_object('customer', jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone))
  from dr.sites s join dr.customers c on c.id = s.customer_id where s.id = p_site;
$$;

create or replace function dr.visit_json(v dr.visits) returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(v) || jsonb_build_object('user_name', (select name from dr.users where id = v.user_id),
    'site_label', (select s.label from dr.sites s where s.id = v.site_id),
    'customer_name', (select c.name from dr.sites s join dr.customers c on c.id = s.customer_id where s.id = v.site_id),
    'arrive_hm', to_char(v.arrive_at at time zone 'Asia/Beirut', 'HH24:MI'),
    'leave_hm', to_char(v.leave_at at time zone 'Asia/Beirut', 'HH24:MI'));
$$;

-- site-sheet actions; called from dr_api (which has already checked the session)
create or replace function dr.site_api(me dr.users, p_action text, p jsonb, d date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare boss boolean := me.role in ('admin','foreman'); adm boolean := me.role = 'admin';
  s dr.sites; v dr.visits; sh dr.site_sheets; rid uuid; ids uuid[]; ids2 uuid[]; lat float8; lng float8;
  today date := (now() at time zone 'Asia/Beirut')::date;
begin
  if p_action = 'visit_arrive' then
    select * into s from dr.sites where id = (p->>'site_id')::uuid;
    if s.id is null then return '{"error":"bad","msg":"اختر الموقع"}'; end if;
    if exists (select 1 from dr.visits where user_id = me.id and leave_at is null and site_id <> s.id and date = today) then
      return '{"error":"bad","msg":"إنت بعدك مسجّل بموقع تاني — كبس «طلعت» هونيك أول"}'; end if;
    select * into v from dr.visits where user_id = me.id and site_id = s.id and date = today and leave_at is null;
    if v.id is not null then return jsonb_build_object('ok', true, 'visit', dr.visit_json(v), 'again', true); end if;
    lat := nullif(p->>'lat', '')::float8; lng := nullif(p->>'lng', '')::float8;
    insert into dr.visits(user_id, date, site_id, task_id, arrive_lat, arrive_lng, arrive_acc, arrive_dist_m)
    values (me.id, today, s.id, nullif(p->>'task_id', '')::uuid, lat, lng, nullif(p->>'acc', '')::float8, dr.dist_m(s.lat, s.lng, lat, lng))
    returning * into v;
    if v.task_id is not null then update dr.tasks set status = 'in_progress', started_at = coalesce(started_at, now()) where id = v.task_id and status = 'planned'; end if;
    return jsonb_build_object('ok', true, 'visit', dr.visit_json(v), 'site_has_gps', s.lat is not null);

  elsif p_action = 'visit_leave' then
    select * into v from dr.visits where id = (p->>'id')::uuid and user_id = me.id;
    if v.id is null then return '{"error":"bad","msg":"ما في وصول مسجّل"}'; end if;
    if v.leave_at is not null then return jsonb_build_object('ok', true, 'visit', dr.visit_json(v)); end if;
    select * into s from dr.sites where id = v.site_id;
    lat := nullif(p->>'lat', '')::float8; lng := nullif(p->>'lng', '')::float8;
    update dr.visits set leave_at = now(), leave_lat = lat, leave_lng = lng, leave_acc = nullif(p->>'acc', '')::float8,
      leave_dist_m = dr.dist_m(s.lat, s.lng, lat, lng) where id = v.id returning * into v;
    return jsonb_build_object('ok', true, 'visit', dr.visit_json(v));

  elsif p_action = 'site_fix_gps' then
    -- the site's GPS comes from the crew's own arrival there (server copy, never typed by the worker)
    select * into s from dr.sites where id = (p->>'site_id')::uuid;
    if s.id is null then return '{"error":"bad"}'; end if;
    if s.lat is not null and not boss then return '{"error":"bad","msg":"الموقع مسجّل من قبل — المدير بيعدّله"}'; end if;
    select * into v from dr.visits where site_id = s.id and user_id = me.id and arrive_lat is not null order by arrive_at desc limit 1;
    if v.id is null then return '{"error":"bad","msg":"كبس «وصلت» وإنت بالموقع أول"}'; end if;
    if coalesce(v.arrive_acc, 9999) > 150 then return '{"error":"bad","msg":"دقة الـ GPS ضعيفة وقت الوصول — طلاع لبرّا وكبّس «وصلت» من جديد بكرا"}'; end if;
    update dr.sites set lat = v.arrive_lat, lng = v.arrive_lng, map_url = null, gps_source = 'arrival', updated_at = now() where id = s.id;
    update dr.visits set arrive_dist_m = 0 where id = v.id;
    return '{"ok":true}';

  elsif p_action = 'sitesheet_get' then
    rid := (p->>'site_id')::uuid;
    if not dr.can_site(me, rid, d) then return '{"error":"forbidden","msg":"هالموقع مش بمهامك"}'; end if;
    select * into sh from dr.site_sheets where site_id = rid and date = d;
    return jsonb_build_object(
      'site', dr.site_json(rid),
      'sheet', case when sh.id is null then null else to_jsonb(sh) || jsonb_build_object('work_photos', dr.photo_json(sh.work_photo_ids), 'paper_photos', dr.photo_json(sh.paper_photo_ids)) end,
      'visits', (select coalesce(jsonb_agg(dr.visit_json(v2) order by v2.arrive_at), '[]') from dr.visits v2 where v2.site_id = rid and v2.date = d),
      'expenses', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('user_name', (select name from dr.users where id = x.user_id), 'photos', dr.photo_json(x.photo_ids)) order by x.created_at), '[]') from dr.expenses x where x.site_id = rid and x.date = d),
      'payments', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('user_name', (select name from dr.users where id = x.user_id), 'photos', dr.photo_json(x.photo_ids)) order by x.created_at), '[]') from dr.payments x where x.site_id = rid and x.date = d),
      'tasks', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'status', t.status, 'assignees', t.assignees)), '[]') from dr.tasks t where t.site_id = rid and t.date = d));

  elsif p_action = 'sitesheet_save' then
    rid := (p->>'site_id')::uuid;
    if not dr.can_site(me, rid, d) then return '{"error":"forbidden","msg":"هالموقع مش بمهامك"}'; end if;
    if not boss and d < today - 1 then return '{"error":"bad","msg":"الورقة بتنكتب نفس النهار أو تاني يوم بس"}'; end if;
    select * into sh from dr.site_sheets where site_id = rid and date = d;
    if sh.closed and not boss then return '{"error":"bad","msg":"الورقة مسكّرة — اطلب من الفورمان يفتحها"}'; end if;
    select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p->'work_photo_ids', '[]'));
    select coalesce(array_agg(value::uuid), '{}') into ids2 from jsonb_array_elements_text(coalesce(p->'paper_photo_ids', '[]'));
    if coalesce((p->>'close')::boolean, false) then
      if coalesce(p->>'mode', 'app') = 'paper' then
        if cardinality(ids2) = 0 then return '{"error":"photos","msg":"صوّر الورقة المطبوعة قبل التسكير"}'; end if;
      else
        if cardinality(ids) = 0 then return '{"error":"photos","msg":"صوّر الشغل المنجز قبل التسكير"}'; end if;
        if length(trim(coalesce(p->>'work', ''))) < 8 then return '{"error":"bad","msg":"اكتب شو انعمل اليوم بالموقع"}'; end if;
      end if;
      if exists (select 1 from dr.visits where site_id = rid and date = d and leave_at is null and user_id = me.id) then
        return '{"error":"bad","msg":"كبّس «طلعت» قبل ما تسكّر الورقة"}'; end if;
    end if;
    insert into dr.site_sheets(date, site_id, mode, work, work_photo_ids, paper_photo_ids, materials, fixes, notes, closed, closed_at, closed_by, updated_by)
    values (d, rid, coalesce(nullif(p->>'mode', ''), 'app'), p->>'work', ids, ids2, coalesce(p->'materials', '[]'), coalesce(p->'fixes', '{}'), p->>'notes',
            coalesce((p->>'close')::boolean, false), case when (p->>'close')::boolean then now() end, case when (p->>'close')::boolean then me.id end, me.id)
    on conflict (date, site_id) do update set mode = excluded.mode, work = excluded.work, work_photo_ids = excluded.work_photo_ids,
      paper_photo_ids = excluded.paper_photo_ids, materials = excluded.materials, fixes = excluded.fixes, notes = excluded.notes,
      closed = excluded.closed, closed_at = excluded.closed_at, closed_by = excluded.closed_by, updated_by = me.id, updated_at = now()
    returning * into sh;
    if p ? 'paper_read' then update dr.site_sheets set paper_read = p->'paper_read' where id = sh.id; end if;
    perform dr.sheet_to_stock(sh.id, me.id);
    -- a missing phone is filled straight away; name/address changes wait for the admin
    if coalesce(trim(sh.fixes->>'phone'), '') <> '' then
      update dr.customers set phone = trim(sh.fixes->>'phone'), updated_at = now()
      where id = (select customer_id from dr.sites where id = rid) and coalesce(phone, '') = '';
    end if;
    return jsonb_build_object('ok', true, 'id', sh.id);

  elsif p_action = 'fix_apply' then
    if not adm then return '{"error":"forbidden"}'; end if;
    select * into sh from dr.site_sheets where id = (p->>'id')::uuid;
    if sh.id is null then return '{"error":"bad"}'; end if;
    if coalesce(trim(sh.fixes->>'name'), '') <> '' then
      update dr.customers set name = trim(sh.fixes->>'name'), updated_at = now() where id = (select customer_id from dr.sites where id = sh.site_id);
    end if;
    if coalesce(trim(sh.fixes->>'phone'), '') <> '' then
      update dr.customers set phone = trim(sh.fixes->>'phone'), updated_at = now() where id = (select customer_id from dr.sites where id = sh.site_id);
    end if;
    if coalesce(trim(sh.fixes->>'address'), '') <> '' then
      update dr.sites set address = trim(sh.fixes->>'address'), updated_at = now() where id = sh.site_id;
    end if;
    update dr.site_sheets set fixes_applied = true where id = sh.id;
    return '{"ok":true}';

  elsif p_action = 'unified' then
    if not boss then return '{"error":"forbidden"}'; end if;
    return jsonb_build_object('date', d,
      'visits', (select coalesce(jsonb_agg(dr.visit_json(v2) order by v2.arrive_at), '[]') from dr.visits v2 where v2.date = d),
      'sheets', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('site', dr.site_json(x.site_id), 'work_photos', dr.photo_json(x.work_photo_ids), 'paper_photos', dr.photo_json(x.paper_photo_ids),
                  'updated_by_name', (select name from dr.users where id = x.updated_by)) order by x.created_at), '[]') from dr.site_sheets x where x.date = d),
      'expenses', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('user_name', (select name from dr.users where id = x.user_id), 'site_label', (select label from dr.sites where id = x.site_id),
                  'customer_name', (select name from dr.customers where id = x.customer_id), 'photos', dr.photo_json(x.photo_ids)) order by x.created_at), '[]') from dr.expenses x where x.date = d),
      'payments', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('user_name', (select name from dr.users where id = x.user_id), 'site_label', (select label from dr.sites where id = x.site_id),
                  'photos', dr.photo_json(x.photo_ids)) order by x.created_at), '[]') from dr.payments x where x.date = d),
      'tasks', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'site_id', t.site_id, 'customer_id', t.customer_id, 'assignees', t.assignees, 'status', t.status)), '[]') from dr.tasks t where t.date = d and t.status <> 'cancelled'));
  end if;
  return null;
end $$;
revoke all on function dr.site_api(dr.users, text, jsonb, date) from public;
revoke all on function dr.can_site(dr.users, uuid, date) from public;
