-- iCOOL Daily Report — 008: photo-first site day (Ahmad 24/11/2026: «طريقة التعبئة غير سهلة» → «العامل بصوّر بس»)
-- The worker only: وصلت · 📷 work · 🧾 invoice · 📦 goods · 📄 paper sheet · (optional note) · طلعت.
-- Each photo is a «snap» on the site's sheet for the day. Invoices, goods and paper sheets are queued for reading in
-- منصة يوميات iCOOL; the result fills the sheet by itself (expenses from invoices, goods received, the paper sheet's lines).
-- Maher / Ahmad review in the unified sheet and approve each site with one tap.

alter table dr.site_sheets add column if not exists snaps jsonb not null default '[]';
alter table dr.read_queue add column if not exists snap_kind text;

create table if not exists dr.config (key text primary key, value text not null, updated_at timestamptz not null default now());
alter table dr.config enable row level security;

insert into dr.config(key, value) values ('prompt_invoice', $p$Read the photo of ONE purchase receipt or invoice handed in by an iCOOL crew (Lebanon; Arabic/English/French; often a fuel-station ticket or a small shop bill, sometimes handwritten).
Context: {{HINT}}
Rules: read only what is printed or written, never invent. Amounts: keep the currency as printed ("$", "LL" for ل.ل/LBP/ليرة; Lebanese lira amounts are large, e.g. 1,790,000). Fuel tickets: product (بنزين 95/98, مازوت/diesel), litres, unit price, total. Dates as YYYY-MM-DD (day first on Lebanese receipts).
kind: "fuel" (station, بنزين, مازوت, diesel, gasoline), "repair" (garage, oil change, tyre, spare part for a vehicle), "goods" (materials, hardware, electrical, plumbing), "other" (food, wash, parking, tools…).
OUTPUT: ONLY one JSON object, no prose:
{"vendor":"shop/station name","date":"YYYY-MM-DD or null","kind":"fuel","total":"amount as number text","currency":"$","items":[{"item":"","qty":"","unit_price":"","amount":""}],"liters":null,"fuel_type":null,"is_receipt":true,"confidence":"high|medium|low","doubts":["short Arabic notes"]}$p$)
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into dr.config(key, value) values ('prompt_goods', $p$Read the photo taken by an iCOOL crew of GOODS that arrived or were taken at a work site: a delivery note / supplier slip, a handwritten list, or the materials themselves (cables, pipes, panels, breakers, fittings…).
Context: {{HINT}}
Rules: list every item with its quantity and unit as written or as clearly visible (count items only when certain; else qty null and say so in doubts). Keep sizes (e.g. كابل 6مم، قسطل 20، بريكر 32A). Supplier name if printed.
Vocabulary: مبروم = multicore (4-1-5 = 4x1.5); مفرد = single-core; مسيفور = MC4; اسبيدي = SPD; بيفسي = PVC; قرل/قطل = قسطل; دجنتير = breaker; تابلو; كاش كابل = lug.
OUTPUT: ONLY one JSON object, no prose:
{"supplier":null,"date":null,"items":[{"item":"","qty":"","unit":null,"uncertain":null}],"kind":"delivery_note|list|photo_of_goods","confidence":"high|medium|low","doubts":["short Arabic notes"]}$p$)
on conflict (key) do update set value = excluded.value, updated_at = now();

create or replace function dr.snap_api(me dr.users, p_action text, p jsonb, d date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare boss boolean := me.role in ('admin','foreman'); sid uuid; ph uuid; k text; sh dr.site_sheets; qid uuid;
  today date := (now() at time zone 'Asia/Beirut')::date;
begin
  if p_action = 'snap' then
    sid := (p->>'site_id')::uuid; ph := (p->>'photo_id')::uuid; k := p->>'kind';
    if k not in ('work','invoice','goods','paper') then return '{"error":"bad"}'; end if;
    if not exists (select 1 from dr.photos where id = ph and user_id = me.id) then return '{"error":"bad","msg":"صورة مش إلك"}'; end if;
    if not dr.can_site(me, sid, today) then return '{"error":"forbidden","msg":"كبّس «وصلت» أول"}'; end if;
    insert into dr.site_sheets(date, site_id, mode, updated_by) values (today, sid, 'app', me.id) on conflict (date, site_id) do nothing;
    update dr.site_sheets set
      snaps = snaps || jsonb_build_array(jsonb_build_object('photo_id', ph, 'kind', k, 'at', now(), 'user_id', me.id, 'user', me.name, 'status', case when k = 'work' then 'done' else 'pending' end)),
      work_photo_ids = case when k = 'work' then work_photo_ids || ph else work_photo_ids end,
      paper_photo_ids = case when k = 'paper' then paper_photo_ids || ph else paper_photo_ids end,
      updated_by = me.id, updated_at = now()
    where date = today and site_id = sid returning * into sh;
    if k <> 'work' then
      if not exists (select 1 from dr.photo_data where photo_id = ph) then return '{"error":"bad","msg":"الصورة لسّا عم تتحمّل — جرّب كمان مرة"}'; end if;
      insert into dr.read_queue(kind, site_id, date, photo_ids, hint, requested_by, snap_kind)
      values ('site', sid, today, array[ph], jsonb_build_object('snap', k, 'site', (select c.name || ' — ' || s.label from dr.sites s join dr.customers c on c.id = s.customer_id where s.id = sid), 'by', me.name), me.id, k)
      returning id into qid;
    end if;
    return jsonb_build_object('ok', true, 'queued', qid is not null);

  elsif p_action = 'snap_note' then
    sid := (p->>'site_id')::uuid;
    if coalesce(trim(p->>'text'), '') = '' then return '{"error":"bad","msg":"اكتب الملاحظة"}'; end if;
    if not dr.can_site(me, sid, today) then return '{"error":"forbidden"}'; end if;
    insert into dr.site_sheets(date, site_id, mode, updated_by) values (today, sid, 'app', me.id) on conflict (date, site_id) do nothing;
    update dr.site_sheets set notes = concat_ws(E'\n', nullif(notes, ''), me.name || ': ' || trim(p->>'text')),
      work = case when coalesce(work, '') = '' then trim(p->>'text') else work end, updated_at = now()
    where date = today and site_id = sid;
    return '{"ok":true}';

  elsif p_action = 'sheet_approve' then
    if not boss then return '{"error":"forbidden"}'; end if;
    update dr.site_sheets set closed = true, closed_at = now(), closed_by = me.id, updated_by = me.id, updated_at = now()
    where id = (p->>'id')::uuid returning * into sh;
    if sh.id is null then return '{"error":"bad"}'; end if;
    perform dr.sheet_to_stock(sh.id, me.id);
    return '{"ok":true}';
  end if;
  return null;
end $$;
revoke all on function dr.snap_api(dr.users, text, jsonb, date) from public;

-- the reader gets the prompt for snaps from dr.config
create or replace function dr.reader_next() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q dr.read_queue;
begin
  select * into q from dr.read_queue
  where status = 'pending' or (status = 'working' and picked_at < now() - interval '6 minutes')
  order by created_at limit 1 for update skip locked;
  if q.id is null then return null; end if;
  update dr.read_queue set status = 'working', picked_at = now() where id = q.id;
  return jsonb_build_object('id', q.id, 'kind', q.kind, 'date', q.date, 'hint', q.hint, 'snap', q.snap_kind,
    'prompt', case q.snap_kind when 'invoice' then (select value from dr.config where key = 'prompt_invoice') when 'goods' then (select value from dr.config where key = 'prompt_goods') end,
    'by', (select name from dr.users where id = q.requested_by),
    'site', (select c.name || ' — ' || s.label from dr.sites s join dr.customers c on c.id = s.customer_id where s.id = q.site_id),
    'images', (select coalesce(jsonb_agg(x.b64 order by array_position(q.photo_ids, x.photo_id)), '[]') from dr.photo_data x where x.photo_id = any(q.photo_ids)),
    'pending', (select count(*) from dr.read_queue where status = 'pending'));
end $$;

create or replace function dr.num_of(t text) returns numeric
language sql immutable as $$
  select case when s = '' then null when s ~ '^\d{1,3}(\.\d{3})+$' then replace(s, '.', '')::numeric when s ~ '^\d*\.?\d+$' then s::numeric else null end
  from (select regexp_replace(translate(coalesce(t, ''), '٠١٢٣٤٥٦٧٨٩٫', '0123456789.'), '[^0-9.]', '', 'g') as s) x;
$$;

-- a finished read fills the site sheet by itself
create or replace function dr.reader_done(p_id uuid, p_result jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q dr.read_queue; sh dr.site_sheets; it jsonb; mats jsonb := '[]'; amt numeric; cust uuid; k text;
begin
  update dr.read_queue set status = 'done', result = p_result, error = null, done_at = now() where id = p_id returning * into q;
  if q.id is null or q.kind <> 'site' then return jsonb_build_object('ok', q.id is not null); end if;
  select * into sh from dr.site_sheets where site_id = q.site_id and date = q.date;
  select customer_id into cust from dr.sites where id = q.site_id;
  if sh.id is not null then
    update dr.site_sheets set snaps = (select coalesce(jsonb_agg(case when (s->>'photo_id')::uuid = any(q.photo_ids) then s || jsonb_build_object('status', 'done', 'read', p_result) else s end), '[]') from jsonb_array_elements(snaps) s)
    where id = sh.id;
  end if;

  if q.snap_kind = 'invoice' then
    amt := dr.num_of(p_result->>'total');
    k := case when p_result->>'kind' in ('fuel','repair','goods','other') then p_result->>'kind' else 'other' end;
    if amt is not null and amt > 0 and coalesce((p_result->>'is_receipt')::boolean, true) then
      insert into dr.expenses(user_id, date, kind, item, qty, amount, currency, source, paid_by, customer_id, site_id, photo_ids, review_note)
      values (q.requested_by, q.date, k,
        coalesce(nullif(concat_ws(' ', p_result->>'fuel_type', case when p_result->>'liters' is not null then (p_result->>'liters') || ' ل' end), ''),
                 (select string_agg(x->>'item', '، ') from jsonb_array_elements(coalesce(p_result->'items', '[]')) x), 'فاتورة'),
        p_result->>'liters', amt, case when p_result->>'currency' = 'LL' then 'LL' else '$' end,
        coalesce(nullif(trim(p_result->>'vendor'), ''), 'فاتورة مصوّرة'), 'غير محدد — من فاتورة مصوّرة', cust, q.site_id, q.photo_ids,
        'انقرت تلقائياً' || coalesce(' · ' || nullif(array_to_string(array(select jsonb_array_elements_text(coalesce(p_result->'doubts', '[]'))), ' · '), ''), ''));
    end if;

  elsif q.snap_kind = 'goods' and sh.id is not null and not sh.closed then
    for it in select * from jsonb_array_elements(coalesce(p_result->'items', '[]')) loop
      if coalesce(trim(it->>'item'), '') <> '' then
        mats := mats || jsonb_build_array(jsonb_build_object('item', it->>'item', 'qty', coalesce(it->>'qty', ''), 'unit', it->>'unit', 'kind', 'received', 'place', 'بالموقع',
          'source', coalesce(p_result->>'supplier', ''), 'uncertain', it->>'uncertain', 'from_photo', true));
      end if;
    end loop;
    update dr.site_sheets set materials = materials || mats, updated_at = now() where id = sh.id;

  elsif sh.id is not null then
    -- paper sheet (or legacy request): keep the reading, and fill an open sheet with its lines
    update dr.site_sheets set paper_read = p_result where id = sh.id and paper_read is null;
    if not sh.closed then
      for it in select * from jsonb_array_elements(coalesce(p_result->'materials', '[]')) loop
        if coalesce(trim(it->>'item'), '') <> '' and not coalesce((it->>'crossed_out')::boolean, false) then
          mats := mats || jsonb_build_array(jsonb_build_object('item', it->>'item', 'qty', coalesce(it->>'qty', ''), 'unit', it->>'unit',
            'kind', case when it->>'kind' in ('received','used','left') then it->>'kind' else 'used' end,
            'place', case when it->>'place' in ('بالموقع','بالفان','برابيد الفورمان','برابيد المحل','بالبيك أب','بالمحل / المستودع') then it->>'place' else 'بالموقع' end,
            'source', coalesce(it->>'source', ''), 'uncertain', it->>'uncertain', 'from_photo', true));
        end if;
      end loop;
      update dr.site_sheets set materials = materials || mats,
        work = case when coalesce(work, '') = '' then p_result->>'work' else work end, updated_at = now() where id = sh.id;
    end if;
  end if;
  return '{"ok":true}';
end $$;
revoke all on function dr.reader_next() from public, anon, authenticated;
revoke all on function dr.reader_done(uuid, jsonb) from public, anon, authenticated;

-- route the new actions (dr_api patched in place)
do $mig$
declare f text; g text;
begin
  f := pg_get_functiondef('public.dr_api(uuid,text,jsonb)'::regprocedure);
  if position('dr.snap_api' in f) > 0 then return; end if;
  g := replace(f, $a$  elsif p_action in ('photo_data', 'read_request', 'read_get') then$a$, $b$  elsif p_action in ('snap', 'snap_note', 'sheet_approve') then
    return dr.snap_api(me, p_action, p, d);

  elsif p_action in ('photo_data', 'read_request', 'read_get') then$b$);
  if g = f then raise exception 'dr_api not patched'; end if;
  execute g;
end $mig$;
