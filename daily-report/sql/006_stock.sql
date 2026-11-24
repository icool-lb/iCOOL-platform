-- iCOOL Daily Report — 006: vehicle & store stock (جردة السيارات) + handwriting reading results on site sheets (24/11/2026)
-- Ledger of stock lines per location (الفان، رابيد الفورمان، رابيد المحل، البيك أب، المحل / المستودع):
--   count = a stock-take of that item at that place (sets the balance at that moment)
--   in / out = movements (loading, unloading, goods received into a vehicle, goods used from it)
-- balance(location, item) = last count + ins − outs after it. Closing a site sheet writes its goods lines here.

create table if not exists dr.stock (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default clock_timestamp(),
  date date not null,
  location text not null,
  item text not null,
  qty numeric not null,
  unit text,
  kind text not null check (kind in ('count','in','out')),
  reason text,
  site_id uuid references dr.sites(id) on delete set null,
  sheet_id uuid references dr.site_sheets(id) on delete cascade,
  batch uuid,
  user_id uuid references dr.users(id),
  note text
);
create index if not exists stock_loc on dr.stock(location, item, at);
alter table dr.stock enable row level security;

alter table dr.site_sheets add column if not exists paper_read jsonb;

create or replace function dr.loc_of(place text) returns text
language sql immutable as $$
  select case trim(coalesce(place, ''))
    when 'بالفان' then 'الفان' when 'برابيد الفورمان' then 'رابيد الفورمان' when 'برابيد المحل' then 'رابيد المحل'
    when 'بالبيك أب' then 'البيك أب' when 'بالمحل / المستودع' then 'المحل / المستودع' else null end;
$$;

create or replace function dr.stock_balance() returns jsonb
language sql stable security definer set search_path = '' as $$
  with keys as (select distinct location, item from dr.stock),
  last_count as (
    select distinct on (location, item) location, item, qty, at, unit from dr.stock where kind = 'count' order by location, item, at desc),
  bal as (
    select k.location, k.item,
      coalesce(lc.qty, 0) + coalesce((select sum(case when s.kind = 'in' then s.qty else -s.qty end) from dr.stock s
        where s.location = k.location and s.item = k.item and s.kind <> 'count' and (lc.at is null or s.at > lc.at)), 0) as qty,
      lc.at as counted_at,
      (select max(s.at) from dr.stock s where s.location = k.location and s.item = k.item) as last_at,
      coalesce(lc.unit, (select s.unit from dr.stock s where s.location = k.location and s.item = k.item and s.unit is not null order by s.at desc limit 1)) as unit
    from keys k left join last_count lc on lc.location = k.location and lc.item = k.item)
  select coalesce(jsonb_agg(jsonb_build_object('location', location, 'item', item, 'qty', qty, 'unit', unit, 'counted_at', counted_at, 'last_at', last_at) order by location, item), '[]')
  from bal where qty <> 0 or counted_at is not null;
$$;

-- goods lines of a closed site sheet → stock ledger (rewritten each time the sheet is saved closed)
create or replace function dr.sheet_to_stock(p_sheet uuid, p_user uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare sh dr.site_sheets; m jsonb; loc text; n int := 0; q numeric;
begin
  select * into sh from dr.site_sheets where id = p_sheet;
  delete from dr.stock where sheet_id = p_sheet;
  if sh.id is null or not sh.closed then return 0; end if;
  for m in select * from jsonb_array_elements(coalesce(sh.materials, '[]')) loop
    loc := dr.loc_of(m->>'place');
    q := nullif(regexp_replace(translate(coalesce(m->>'qty', ''), '٠١٢٣٤٥٦٧٨٩,', '0123456789.'), '[^0-9.]', '', 'g'), '')::numeric;
    if loc is null or q is null or coalesce(trim(m->>'item'), '') = '' then continue; end if;
    insert into dr.stock(date, location, item, qty, unit, kind, reason, site_id, sheet_id, user_id)
    values (sh.date, loc, trim(m->>'item'), q, m->>'unit',
      case m->>'kind' when 'received' then 'in' when 'used' then 'out' else 'count' end,
      case m->>'kind' when 'received' then 'استلام' || coalesce(' من ' || nullif(m->>'source', ''), '') when 'used' then 'استعمال بالموقع' else 'باقي (من ورقة الموقع)' end,
      sh.site_id, sh.id, p_user);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function dr.stock_api(me dr.users, p_action text, p jsonb, d date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare boss boolean := me.role in ('admin','foreman'); b uuid := gen_random_uuid(); it jsonb; q numeric; n int := 0; v_from text; v_to text;
begin
  if p_action = 'stock' then
    return jsonb_build_object('balance', dr.stock_balance(),
      'recent', (select coalesce(jsonb_agg(x order by x.at desc), '[]') from (
         select s.at, s.date, s.location, s.item, s.qty, s.unit, s.kind, s.reason, s.note, u.name as user_name,
           (select c.name || ' — ' || st.label from dr.sites st join dr.customers c on c.id = st.customer_id where st.id = s.site_id) as site
         from dr.stock s left join dr.users u on u.id = s.user_id order by s.at desc limit 60) x),
      'items', (select coalesce(jsonb_agg(distinct item), '[]') from dr.stock));

  elsif p_action = 'stock_count' then
    v_to := trim(coalesce(p->>'location', ''));
    if v_to = '' then return '{"error":"bad","msg":"اختر السيارة أو المحل"}'; end if;
    for it in select * from jsonb_array_elements(coalesce(p->'items', '[]')) loop
      q := nullif(it->>'qty', '')::numeric;
      if q is null or coalesce(trim(it->>'item'), '') = '' then continue; end if;
      insert into dr.stock(date, location, item, qty, unit, kind, reason, batch, user_id, note)
      values (d, v_to, trim(it->>'item'), q, nullif(it->>'unit', ''), 'count', 'جردة', b, me.id, p->>'note');
      n := n + 1;
    end loop;
    if n = 0 then return '{"error":"bad","msg":"ما في أصناف"}'; end if;
    return jsonb_build_object('ok', true, 'n', n);

  elsif p_action = 'stock_move' then
    v_from := nullif(trim(coalesce(p->>'from', '')), ''); v_to := nullif(trim(coalesce(p->>'to', '')), '');
    if v_from is null and v_to is null then return '{"error":"bad","msg":"من وين ولوين؟"}'; end if;
    if v_from = v_to then return '{"error":"bad","msg":"نفس المكان"}'; end if;
    for it in select * from jsonb_array_elements(coalesce(p->'items', '[]')) loop
      q := nullif(it->>'qty', '')::numeric;
      if q is null or q <= 0 or coalesce(trim(it->>'item'), '') = '' then continue; end if;
      if v_from is not null then
        insert into dr.stock(date, location, item, qty, unit, kind, reason, batch, user_id, note)
        values (d, v_from, trim(it->>'item'), q, nullif(it->>'unit', ''), 'out', coalesce('تنزيل لـ' || v_to, 'تنزيل / استعمال'), b, me.id, p->>'note');
      end if;
      if v_to is not null then
        insert into dr.stock(date, location, item, qty, unit, kind, reason, batch, user_id, note)
        values (d, v_to, trim(it->>'item'), q, nullif(it->>'unit', ''), 'in', coalesce('تحميل من ' || v_from, 'تحميل من مورد'), b, me.id, p->>'note');
      end if;
      n := n + 1;
    end loop;
    if n = 0 then return '{"error":"bad","msg":"ما في أصناف"}'; end if;
    return jsonb_build_object('ok', true, 'n', n);
  end if;
  return null;
end $$;
revoke all on function dr.stock_api(dr.users, text, jsonb, date) from public;
revoke all on function dr.sheet_to_stock(uuid, uuid) from public;
revoke all on function dr.stock_balance() from public;
