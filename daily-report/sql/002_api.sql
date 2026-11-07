-- iCOOL Daily Report — API (security definer; the browser holds only a session token)

create or replace function public.dr_users_public() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role) order by
    case role when 'admin' then 0 when 'foreman' then 1 else 2 end, name), '[]'::jsonb)
  from dr.users where active;
$$;

create or replace function public.dr_login(p_user uuid, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u dr.users; n int; s dr.sessions;
begin
  select count(*) into n from dr.login_fails where user_id = p_user and at > now() - interval '15 minutes';
  if n >= 6 then return jsonb_build_object('error', 'محاولات كثيرة — جرّب بعد ربع ساعة'); end if;
  select * into u from dr.users where id = p_user and active;
  if u.id is null or u.pin_hash <> extensions.crypt(coalesce(p_pin, ''), u.pin_hash) then
    insert into dr.login_fails(user_id) values (p_user);
    return jsonb_build_object('error', 'الرمز غلط');
  end if;
  delete from dr.login_fails where user_id = u.id;
  delete from dr.sessions where expires_at < now();
  insert into dr.sessions(user_id) values (u.id) returning * into s;
  return jsonb_build_object('token', s.token, 'ticket', s.ticket,
    'me', jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role, 'platform_name', u.platform_name));
end $$;

-- maintenance plans → tasks (next 7 days)
create or replace function dr.gen_plans() returns int
language plpgsql security definer set search_path = '' as $$
declare p dr.plans; c int := 0;
begin
  for p in select * from dr.plans where active and next_date <= current_date + 7 loop
    if not exists (select 1 from dr.tasks where plan_id = p.id and date = p.next_date) then
      insert into dr.tasks(date, customer_id, title, kind, details, assignees, plan_id)
      values (p.next_date, p.customer_id, p.title, p.kind, p.notes, p.assignees, p.id);
      c := c + 1;
    end if;
    update dr.plans set next_date = next_date + every_days where id = p.id and next_date <= current_date + 7
      and exists (select 1 from dr.tasks where plan_id = p.id and date = p.next_date);
  end loop;
  return c;
end $$;

create or replace function dr.photo_json(ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'path', path, 'kind', kind) order by created_at), '[]'::jsonb)
  from dr.photos where id = any(coalesce(ids, '{}'));
$$;

create or replace function public.dr_api(p_token uuid, p_action text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me dr.users; ses dr.sessions; boss boolean; adm boolean;
  d date; d2 date; rid uuid; r jsonb; t dr.tasks; ids uuid[]; v text;
begin
  select s.* into ses from dr.sessions s where s.token = p_token and s.expires_at > now();
  if ses.token is null then return jsonb_build_object('error', 'session', 'msg', 'انتهت الجلسة — فوت من جديد'); end if;
  select * into me from dr.users where id = ses.user_id and active;
  if me.id is null then return jsonb_build_object('error', 'session', 'msg', 'الحساب موقّف'); end if;
  boss := me.role in ('admin', 'foreman');
  adm := me.role = 'admin';
  d := coalesce(nullif(p->>'date', '')::date, (now() at time zone 'Asia/Beirut')::date);

  if p_action = 'boot' then
    if boss then perform dr.gen_plans(); end if;
    return jsonb_build_object(
      'me', jsonb_build_object('id', me.id, 'name', me.name, 'role', me.role, 'platform_name', me.platform_name),
      'ticket', ses.ticket,
      'today', (now() at time zone 'Asia/Beirut')::date,
      'users', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role, 'platform_name', platform_name, 'phone', case when boss then phone end) order by name), '[]') from dr.users where active));

  elsif p_action = 'logout' then
    delete from dr.sessions where token = p_token;
    return '{"ok":true}';

  elsif p_action = 'pin_change' then
    if me.pin_hash <> extensions.crypt(coalesce(p->>'old', ''), me.pin_hash) then return '{"error":"bad","msg":"الرمز القديم غلط"}'; end if;
    if length(coalesce(p->>'new', '')) < 4 then return '{"error":"bad","msg":"الرمز لازم يكون 4 أرقام عالأقل"}'; end if;
    update dr.users set pin_hash = extensions.crypt(p->>'new', extensions.gen_salt('bf')) where id = me.id;
    delete from dr.sessions where user_id = me.id and token <> p_token;
    return '{"ok":true}';

  -- ---------- one day: tasks, reports, expenses, payments, daylogs ----------
  elsif p_action = 'day' then
    return jsonb_build_object(
      'date', d,
      'tasks', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('customer', (select to_jsonb(c) from dr.customers c where c.id = x.customer_id)) order by x.time nulls last, x.created_at), '[]')
                from dr.tasks x where x.date = d and x.status <> 'cancelled' and (boss or me.id = any(x.assignees))),
      'reports', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('photos', dr.photo_json(x.photo_ids)) order by x.created_at), '[]')
                from dr.reports x where x.date = d and (boss or x.user_id = me.id)),
      'expenses', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('photos', dr.photo_json(x.photo_ids)) order by x.created_at), '[]')
                from dr.expenses x where x.date = d and (boss or x.user_id = me.id)),
      'payments', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('photos', dr.photo_json(x.photo_ids)) order by x.created_at), '[]')
                from dr.payments x where x.date = d and (boss or x.user_id = me.id)),
      'daylogs', case when boss then (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('sheet_photos', dr.photo_json(x.sheet_photo_ids))), '[]') from dr.daylogs x where x.date = d) else '[]' end,
      'platform', case when boss then (select workers from dr.platform_days where date = d) end);

  elsif p_action = 'range' then
    d2 := coalesce(nullif(p->>'to', '')::date, d + 6);
    return jsonb_build_object(
      'tasks', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('customer_name', (select c.name from dr.customers c where c.id = x.customer_id), 'area', (select c.area from dr.customers c where c.id = x.customer_id)) order by x.date, x.time nulls last), '[]')
                from dr.tasks x where x.date between d and d2 and x.status <> 'cancelled' and (boss or me.id = any(x.assignees))),
      'reports', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'user_id', x.user_id, 'date', x.date, 'task_id', x.task_id, 'start_time', x.start_time, 'end_time', x.end_time, 'n_photos', cardinality(x.photo_ids), 'site', x.site, 'work', x.work)), '[]')
                from dr.reports x where x.date between d and d2 and (boss or x.user_id = me.id)),
      'expenses', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'user_id', x.user_id, 'date', x.date, 'kind', x.kind, 'amount', x.amount, 'currency', x.currency, 'status', x.status)), '[]')
                from dr.expenses x where x.date between d and d2 and (boss or x.user_id = me.id)),
      'platform', case when boss then (select coalesce(jsonb_agg(jsonb_build_object('date', date, 'workers', workers)), '[]') from dr.platform_days where date between d and d2) end);

  -- ---------- customers & sites ----------
  elsif p_action = 'customers' then
    return (select coalesce(jsonb_agg(to_jsonb(c) order by c.name), '[]') from dr.customers c
            where boss or exists (select 1 from dr.tasks x where x.customer_id = c.id and me.id = any(x.assignees)));

  elsif p_action = 'customer_get' then
    rid := (p->>'id')::uuid;
    if not boss and not exists (select 1 from dr.tasks x where x.customer_id = rid and me.id = any(x.assignees)) then return '{"error":"forbidden"}'; end if;
    return jsonb_build_object(
      'customer', (select to_jsonb(c) from dr.customers c where c.id = rid),
      'tasks', (select coalesce(jsonb_agg(to_jsonb(x) order by x.date desc), '[]') from (select * from dr.tasks where customer_id = rid order by date desc limit 60) x),
      'reports', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('photos', dr.photo_json(x.photo_ids)) order by x.date desc), '[]')
                  from (select * from dr.reports where customer_id = rid or task_id in (select id from dr.tasks where customer_id = rid) order by date desc limit 60) x),
      'plans', (select coalesce(jsonb_agg(to_jsonb(x)), '[]') from dr.plans x where x.customer_id = rid));

  elsif p_action = 'customer_save' then
    if not boss then return '{"error":"forbidden"}'; end if;
    if coalesce(trim(p->>'name'), '') = '' then return '{"error":"bad","msg":"اسم الزبون مطلوب"}'; end if;
    rid := nullif(p->>'id', '')::uuid;
    if rid is null then
      insert into dr.customers(name, phone, area, address, lat, lng, map_url, notes, platform_name, created_by)
      values (trim(p->>'name'), p->>'phone', p->>'area', p->>'address', nullif(p->>'lat', '')::float8, nullif(p->>'lng', '')::float8, p->>'map_url', p->>'notes', nullif(p->>'platform_name', ''), me.id)
      returning id into rid;
    else
      update dr.customers set name = trim(p->>'name'), phone = p->>'phone', area = p->>'area', address = p->>'address',
        lat = nullif(p->>'lat', '')::float8, lng = nullif(p->>'lng', '')::float8, map_url = p->>'map_url', notes = p->>'notes',
        platform_name = nullif(p->>'platform_name', ''), updated_at = now() where id = rid;
    end if;
    return jsonb_build_object('ok', true, 'id', rid);

  -- ---------- tasks ----------
  elsif p_action = 'task_save' then
    if not boss then return '{"error":"forbidden"}'; end if;
    if coalesce(trim(p->>'title'), '') = '' then return '{"error":"bad","msg":"اكتب شو المهمة"}'; end if;
    select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p->'assignees', '[]'));
    rid := nullif(p->>'id', '')::uuid;
    if rid is null then
      insert into dr.tasks(date, time, customer_id, title, kind, details, assignees, priority, created_by)
      values (d, nullif(p->>'time', ''), nullif(p->>'customer_id', '')::uuid, trim(p->>'title'), coalesce(nullif(p->>'kind', ''), 'work'),
              p->>'details', ids, coalesce(nullif(p->>'priority', ''), 'normal'), me.id) returning id into rid;
    else
      update dr.tasks set date = d, time = nullif(p->>'time', ''), customer_id = nullif(p->>'customer_id', '')::uuid, title = trim(p->>'title'),
        kind = coalesce(nullif(p->>'kind', ''), 'work'), details = p->>'details', assignees = ids,
        priority = coalesce(nullif(p->>'priority', ''), 'normal'), updated_at = now() where id = rid;
    end if;
    return jsonb_build_object('ok', true, 'id', rid);

  elsif p_action = 'task_status' then
    select * into t from dr.tasks where id = (p->>'id')::uuid;
    if t.id is null then return '{"error":"bad","msg":"المهمة مش موجودة"}'; end if;
    if not boss and not (me.id = any(t.assignees)) then return '{"error":"forbidden"}'; end if;
    v := p->>'status';
    if v not in ('planned', 'in_progress', 'done', 'postponed', 'cancelled') then return '{"error":"bad"}'; end if;
    if v = 'cancelled' and not boss then return '{"error":"forbidden"}'; end if;
    if v = 'done' and not boss and not exists (
        select 1 from dr.reports r where r.task_id = t.id and r.user_id = me.id and cardinality(r.photo_ids) > 0) then
      return '{"error":"photos","msg":"ما بتسكر المهمة بلا تقرير وصور للشغل المنجز"}';
    end if;
    update dr.tasks set status = v,
      started_at = case when v = 'in_progress' and started_at is null then now() else started_at end,
      done_at = case when v = 'done' then now() else null end,
      done_by = case when v = 'done' then me.id else null end,
      date = case when v = 'postponed' and p ? 'new_date' then (p->>'new_date')::date else date end,
      updated_at = now() where id = t.id;
    if v = 'postponed' and p ? 'new_date' then update dr.tasks set status = 'planned' where id = t.id; end if;
    return '{"ok":true}';

  -- ---------- photos ----------
  elsif p_action = 'photo_add' then
    v := p->>'path';
    if v is null or split_part(v, '/', 1) <> ses.ticket::text then return '{"error":"bad","msg":"صورة غير صالحة"}'; end if;
    insert into dr.photos(user_id, date, kind, path, task_id)
    values (me.id, d, coalesce(nullif(p->>'kind', ''), 'work'), v, nullif(p->>'task_id', '')::uuid) returning id into rid;
    return jsonb_build_object('ok', true, 'id', rid);

  -- ---------- end-of-day work report (photos mandatory) ----------
  elsif p_action = 'report_save' then
    select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p->'photo_ids', '[]'));
    if cardinality(ids) = 0 then return '{"error":"photos","msg":"التصوير إلزامي: صوّر الشغل المنجز"}'; end if;
    if exists (select 1 from unnest(ids) i where not exists (select 1 from dr.photos ph where ph.id = i and ph.user_id = me.id)) then return '{"error":"bad","msg":"صورة مش إلك"}'; end if;
    if length(trim(coalesce(p->>'work', ''))) < 8 then return '{"error":"bad","msg":"اكتب تفاصيل الشغل المنجز"}'; end if;
    if not boss and d < (now() at time zone 'Asia/Beirut')::date - 1 then return '{"error":"bad","msg":"التقرير بينكتب نفس النهار أو تاني يوم بس"}'; end if;
    rid := nullif(p->>'id', '')::uuid;
    if rid is null then
      insert into dr.reports(user_id, date, task_id, customer_id, site, start_time, end_time, work, photo_ids)
      values (me.id, d, nullif(p->>'task_id', '')::uuid,
        coalesce(nullif(p->>'customer_id', '')::uuid, (select customer_id from dr.tasks where id = nullif(p->>'task_id', '')::uuid)),
        p->>'site', p->>'start_time', p->>'end_time', trim(p->>'work'), ids) returning id into rid;
    else
      update dr.reports set task_id = nullif(p->>'task_id', '')::uuid,
        customer_id = coalesce(nullif(p->>'customer_id', '')::uuid, (select customer_id from dr.tasks where id = nullif(p->>'task_id', '')::uuid)),
        site = p->>'site', start_time = p->>'start_time', end_time = p->>'end_time', work = trim(p->>'work'), photo_ids = ids, updated_at = now()
      where id = rid and user_id = me.id;
    end if;
    return jsonb_build_object('ok', true, 'id', rid);

  -- ---------- goods & fuel: only with invoice photo + source ----------
  elsif p_action = 'expense_save' then
    select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p->'photo_ids', '[]'));
    if cardinality(ids) = 0 then return '{"error":"photos","msg":"بلا صورة فاتورة ما في صرف"}'; end if;
    if length(trim(coalesce(p->>'source', ''))) < 2 then return '{"error":"bad","msg":"اكتب المصدر (المحل أو المحطة)"}'; end if;
    if coalesce(nullif(p->>'amount', '')::numeric, 0) <= 0 then return '{"error":"bad","msg":"اكتب المبلغ"}'; end if;
    insert into dr.expenses(user_id, date, kind, item, qty, amount, currency, source, paid_by, vehicle, customer_id, site, photo_ids)
    values (me.id, d, p->>'kind', coalesce(nullif(trim(p->>'item'), ''), case when p->>'kind' = 'fuel' then 'محروقات' else 'بضاعة' end),
      p->>'qty', (p->>'amount')::numeric, coalesce(nullif(p->>'currency', ''), '$'), trim(p->>'source'),
      coalesce(nullif(p->>'paid_by', ''), me.name), p->>'vehicle', nullif(p->>'customer_id', '')::uuid, p->>'site', ids)
    returning id into rid;
    return jsonb_build_object('ok', true, 'id', rid);

  elsif p_action = 'payment_save' then
    select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p->'photo_ids', '[]'));
    if coalesce(nullif(p->>'amount', '')::numeric, 0) <= 0 then return '{"error":"bad","msg":"اكتب المبلغ"}'; end if;
    if length(trim(coalesce(p->>'party', ''))) < 2 then return '{"error":"bad","msg":"مين قبض/دفع؟"}'; end if;
    insert into dr.payments(user_id, date, kind, party, amount, currency, note, photo_ids)
    values (me.id, d, coalesce(nullif(p->>'kind', ''), 'other'), trim(p->>'party'), (p->>'amount')::numeric, coalesce(nullif(p->>'currency', ''), '$'), p->>'note', ids)
    returning id into rid;
    return jsonb_build_object('ok', true, 'id', rid);

  elsif p_action = 'review' then
    if not adm then return '{"error":"forbidden"}'; end if;
    if p->>'table' = 'expense' then
      update dr.expenses set status = p->>'status', review_note = p->>'note' where id = (p->>'id')::uuid;
    elsif p->>'table' = 'payment' then
      update dr.payments set status = p->>'status' where id = (p->>'id')::uuid;
    end if;
    return '{"ok":true}';

  elsif p_action = 'delete' then
    v := p->>'table'; rid := (p->>'id')::uuid;
    if v = 'report' then delete from dr.reports where id = rid and (adm or (user_id = me.id and date >= (now() at time zone 'Asia/Beirut')::date - 1));
    elsif v = 'expense' then delete from dr.expenses where id = rid and (adm or (user_id = me.id and status = 'pending'));
    elsif v = 'payment' then delete from dr.payments where id = rid and (adm or (user_id = me.id and status = 'pending'));
    elsif v = 'task' and boss then delete from dr.tasks where id = rid;
    elsif v = 'plan' and boss then delete from dr.plans where id = rid;
    else return '{"error":"forbidden"}'; end if;
    return '{"ok":true}';

  -- ---------- foreman daily log (paper photo or phone entry) ----------
  elsif p_action = 'daylog_save' then
    if not boss then return '{"error":"forbidden"}'; end if;
    select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p->'sheet_photo_ids', '[]'));
    if coalesce(p->>'mode', 'paper') = 'paper' and cardinality(ids) = 0 and coalesce((p->>'closed')::boolean, false) then
      return '{"error":"photos","msg":"صوّر الورقة اليومية (الوجهين) قبل التسكير"}';
    end if;
    insert into dr.daylogs(date, foreman_id, mode, sheet_photo_ids, workers, materials, payments, notes, closed, closed_at, updated_at)
    values (d, me.id, coalesce(p->>'mode', 'paper'), ids, coalesce(p->'workers', '[]'), coalesce(p->'materials', '[]'), coalesce(p->'payments', '[]'),
            p->>'notes', coalesce((p->>'closed')::boolean, false), case when (p->>'closed')::boolean then now() end, now())
    on conflict (date, foreman_id) do update set mode = excluded.mode, sheet_photo_ids = excluded.sheet_photo_ids, workers = excluded.workers,
      materials = excluded.materials, payments = excluded.payments, notes = excluded.notes, closed = excluded.closed,
      closed_at = excluded.closed_at, synced_at = null, updated_at = now();
    return '{"ok":true}';

  -- ---------- maintenance plans ----------
  elsif p_action = 'plans' then
    if not boss then return '{"error":"forbidden"}'; end if;
    return (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('customer_name', (select name from dr.customers c where c.id = x.customer_id)) order by x.next_date), '[]') from dr.plans x);

  elsif p_action = 'plan_save' then
    if not boss then return '{"error":"forbidden"}'; end if;
    select coalesce(array_agg(value::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p->'assignees', '[]'));
    rid := nullif(p->>'id', '')::uuid;
    if rid is null then
      insert into dr.plans(customer_id, title, kind, every_days, next_date, assignees, notes, active)
      values ((p->>'customer_id')::uuid, trim(p->>'title'), coalesce(nullif(p->>'kind', ''), 'maintenance'), (p->>'every_days')::int,
              (p->>'next_date')::date, ids, p->>'notes', coalesce((p->>'active')::boolean, true)) returning id into rid;
    else
      update dr.plans set customer_id = (p->>'customer_id')::uuid, title = trim(p->>'title'), every_days = (p->>'every_days')::int,
        next_date = (p->>'next_date')::date, assignees = ids, notes = p->>'notes', active = coalesce((p->>'active')::boolean, true) where id = rid;
    end if;
    perform dr.gen_plans();
    return jsonb_build_object('ok', true, 'id', rid);

  -- ---------- worker account (computed in منصة يوميات iCOOL from Maher's sheets) ----------
  elsif p_action = 'balance' then
    v := case when adm and p ? 'name' then p->>'name' else me.platform_name end;
    return jsonb_build_object('name', v, 'balance', (select data from dr.balances where name = v), 'updated_at', (select updated_at from dr.balances where name = v));

  elsif p_action = 'balances' then
    if not adm then return '{"error":"forbidden"}'; end if;
    return (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'balance', data, 'updated_at', updated_at) order by name), '[]') from dr.balances);

  elsif p_action = 'pending' then
    if not adm then return '{"error":"forbidden"}'; end if;
    return jsonb_build_object(
      'expenses', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('user_name', (select name from dr.users u where u.id = x.user_id),
                     'customer_name', (select name from dr.customers c where c.id = x.customer_id), 'photos', dr.photo_json(x.photo_ids)) order by x.date desc, x.created_at desc), '[]')
                   from dr.expenses x where x.status = 'pending' or x.date >= current_date - 7),
      'payments', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('user_name', (select name from dr.users u where u.id = x.user_id), 'photos', dr.photo_json(x.photo_ids)) order by x.date desc, x.created_at desc), '[]')
                   from dr.payments x where x.status = 'pending' or x.date >= current_date - 7));

  -- ---------- admin ----------
  elsif p_action = 'users' then
    if not adm then return '{"error":"forbidden"}'; end if;
    return (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'role', role, 'platform_name', platform_name, 'phone', phone, 'active', active,
      'last_login', (select max(created_at) from dr.sessions s where s.user_id = u.id)) order by name), '[]') from dr.users u);

  elsif p_action = 'user_save' then
    if not adm then return '{"error":"forbidden"}'; end if;
    rid := nullif(p->>'id', '')::uuid;
    if rid is null then
      if length(coalesce(p->>'pin', '')) < 4 then return '{"error":"bad","msg":"رمز 4 أرقام عالأقل"}'; end if;
      insert into dr.users(name, role, platform_name, phone, pin_hash)
      values (trim(p->>'name'), p->>'role', nullif(p->>'platform_name', ''), p->>'phone', extensions.crypt(p->>'pin', extensions.gen_salt('bf'))) returning id into rid;
    else
      update dr.users set name = trim(p->>'name'), role = p->>'role', platform_name = nullif(p->>'platform_name', ''), phone = p->>'phone',
        active = coalesce((p->>'active')::boolean, true) where id = rid;
      if length(coalesce(p->>'pin', '')) >= 4 then
        update dr.users set pin_hash = extensions.crypt(p->>'pin', extensions.gen_salt('bf')) where id = rid;
        delete from dr.sessions where user_id = rid;
      end if;
      if not coalesce((p->>'active')::boolean, true) then delete from dr.sessions where user_id = rid; end if;
    end if;
    return jsonb_build_object('ok', true, 'id', rid);

  elsif p_action = 'sync_status' then
    if not boss then return '{"error":"forbidden"}'; end if;
    return jsonb_build_object('last', (select to_jsonb(x) from dr.sync_log x order by id desc limit 1),
      'pending_days', (select count(*) from dr.daylogs where closed and synced_at is null));
  end if;

  return jsonb_build_object('error', 'bad', 'msg', 'عملية غير معروفة: ' || p_action);
end $$;

revoke all on function public.dr_users_public() from public;
revoke all on function public.dr_login(uuid, text) from public;
revoke all on function public.dr_api(uuid, text, jsonb) from public;
grant execute on function public.dr_users_public() to anon;
grant execute on function public.dr_login(uuid, text) to anon;
grant execute on function public.dr_api(uuid, text, jsonb) to anon;
revoke all on function dr.gen_plans() from public;
revoke all on function dr.photo_json(uuid[]) from public;

-- ---------- link with منصة يوميات iCOOL (called by the platform through Ahmad's Supabase connector) ----------
-- in: {balances:{name:{...}}, days:{date:[{name,start,end,site,work,ot}]}}
-- out: closed daylogs not yet synced + recent worker reports/expenses for cross-checking
create or replace function dr.platform_sync(p jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare k text; out jsonb;
begin
  for k in select jsonb_object_keys(coalesce(p->'balances', '{}')) loop
    insert into dr.balances(name, data, updated_at) values (k, p->'balances'->k, now())
    on conflict (name) do update set data = excluded.data, updated_at = now();
  end loop;
  for k in select jsonb_object_keys(coalesce(p->'days', '{}')) loop
    insert into dr.platform_days(date, workers, updated_at) values (k::date, p->'days'->k, now())
    on conflict (date) do update set workers = excluded.workers, updated_at = now();
  end loop;
  out := jsonb_build_object(
    'daylogs', (select coalesce(jsonb_agg(to_jsonb(x) || jsonb_build_object('foreman', (select name from dr.users u where u.id = x.foreman_id),
                 'sheet_paths', (select coalesce(jsonb_agg(ph.path), '[]') from dr.photos ph where ph.id = any(x.sheet_photo_ids)))), '[]')
               from dr.daylogs x where x.closed and x.synced_at is null),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object('date', r.date, 'worker', u.platform_name, 'user', u.name, 'start', r.start_time, 'end', r.end_time,
                 'site', coalesce(c.platform_name, c.name, r.site), 'work', r.work, 'photos', cardinality(r.photo_ids))), '[]')
               from dr.reports r join dr.users u on u.id = r.user_id left join dr.customers c on c.id = r.customer_id
               where r.date >= current_date - 21),
    'expenses', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'date', e.date, 'user', u.name, 'kind', e.kind, 'item', e.item, 'amount', e.amount,
                 'currency', e.currency, 'source', e.source, 'status', e.status, 'site', coalesce(c.platform_name, c.name, e.site))), '[]')
               from dr.expenses e join dr.users u on u.id = e.user_id left join dr.customers c on c.id = e.customer_id
               where e.date >= current_date - 21));
  insert into dr.sync_log(info) values (jsonb_build_object('balances', (select count(*) from jsonb_object_keys(coalesce(p->'balances', '{}'))),
    'days', (select count(*) from jsonb_object_keys(coalesce(p->'days', '{}'))), 'daylogs', jsonb_array_length(out->'daylogs')));
  return out;
end $$;

create or replace function dr.platform_mark_synced(p_dates date[]) returns int
language sql security definer set search_path = '' as $$
  with u as (update dr.daylogs set synced_at = now() where closed and date = any(p_dates) returning 1) select count(*)::int from u;
$$;
revoke all on function dr.platform_sync(jsonb) from public;
revoke all on function dr.platform_mark_synced(date[]) from public;
