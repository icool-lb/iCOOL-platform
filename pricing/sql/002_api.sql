-- iCOOL Pricing — API (security definer). The browser holds only a session token.

create or replace function pr.round_rate(x numeric) returns numeric
language sql immutable as $$
  select case when x is null then null
              when x >= 100 then round(x / 5) * 5
              when x >= 10 then round(x * 2) / 2
              else round(x, 2) end;
$$;

create or replace function pr.markup(p_trade text) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce((select (v ->> p_trade)::numeric from pr.settings where k = 'markup'), 0.12);
$$;

-- Suggested client rate for a catalog item: history → supplier cost → manual cost → estimate
create or replace function pr.suggest(p_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  c pr.catalog; r pr.rates; kc pr.costs; mk numeric; days int; cost numeric; cnote text; src text;
begin
  select * into c from pr.catalog where key = p_key;
  if c.key is null then return jsonb_build_object('src', 'none'); end if;
  days := coalesce((select v::text::int from pr.settings where k = 'history_days'), 180);
  mk := coalesce(c.markup_pct, pr.markup(c.trade));

  select * into kc from pr.costs where id = any(c.cost_ids) and net_usd is not null
    order by last_date desc nulls last limit 1;
  if kc.id is not null then
    cost := kc.net_usd; src := 'supplier';
    cnote := coalesce(kc.supplier_name, kc.supplier) || ' ' || coalesce(to_char(kc.last_date, 'DD/MM/YYYY'), '')
             || ' (' || coalesce(kc.source, '') || ')';
  elsif c.cost_usd is not null then
    cost := c.cost_usd; src := 'cost'; cnote := c.cost_note;
  end if;

  select * into r from pr.rates where catalog_key = p_key and at > current_date - days
    order by at desc, id desc limit 1;
  if r.id is not null then
    return jsonb_build_object('rate', r.rate, 'src', 'history', 'cost', coalesce(cost, r.cost_usd),
      'note', 'آخر سعر مثبّت ' || to_char(r.at, 'DD/MM/YYYY'));
  end if;

  if cost is not null then
    return jsonb_build_object('rate', pr.round_rate(cost * (1 + mk) + c.install_usd), 'src', src, 'cost', cost,
      'note', concat_ws(' · ', cnote, 'هامش ' || round(mk * 100) || '%',
                        case when c.install_usd > 0 then 'تركيب ' || c.install_usd || '$' end));
  end if;

  if c.est_rate is not null then
    return jsonb_build_object('rate', c.est_rate, 'src', 'estimate', 'cost', null, 'note', coalesce(c.note, 'تقدير'));
  end if;
  return jsonb_build_object('src', 'none');
end $$;

-- Recompute one line's suggestion; suggested lines follow it, confirmed lines keep their rate
create or replace function pr.refresh_line(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare l pr.lines; s jsonb; kc pr.costs; t text;
begin
  select * into l from pr.lines where id = p_id;
  if l.id is null then return; end if;
  if l.catalog_key is not null then
    s := pr.suggest(l.catalog_key);
  elsif l.cost_id is not null then
    select * into kc from pr.costs where id = l.cost_id;
    select coalesce(p.trade, 'mep') into t from pr.projects p where p.id = l.project_id;
    if kc.net_usd is not null then
      s := jsonb_build_object('rate', pr.round_rate(kc.net_usd * (1 + pr.markup(t))), 'src', 'supplier', 'cost', kc.net_usd,
        'note', coalesce(kc.supplier_name, kc.supplier) || ' ' || coalesce(to_char(kc.last_date, 'DD/MM/YYYY'), '')
                || ' · هامش ' || round(pr.markup(t) * 100) || '% · توريد فقط');
    else s := jsonb_build_object('src', 'none'); end if;
  else
    s := jsonb_build_object('src', 'none');
  end if;
  update pr.lines set
    suggested = (s ->> 'rate')::numeric,
    suggest_src = s ->> 'src',
    suggest_note = s ->> 'note',
    cost_usd = coalesce((s ->> 'cost')::numeric, cost_usd),
    rate = case when status = 'suggested' then (s ->> 'rate')::numeric else rate end,
    updated_at = now()
  where id = p_id;
end $$;

create or replace function pr.project_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'project', to_jsonb(p),
    'lines', coalesce((select jsonb_agg(to_jsonb(l) order by l.pos, l.updated_at) from pr.lines l where l.project_id = p.id), '[]'::jsonb),
    'vat_rate', (select v::text::numeric from pr.settings where k = 'vat'))
  from pr.projects p where p.id = p_id;
$$;

create or replace function pr.log_rate(p_line uuid) returns void
language sql security definer set search_path = '' as $$
  insert into pr.rates(catalog_key, description, unit, rate, cost_usd, project_id)
  select catalog_key, description, unit, rate, cost_usd, project_id from pr.lines
  where id = p_line and rate is not null;
$$;

create or replace function public.pr_login(p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare n int; h text; s pr.sessions;
begin
  select count(*) into n from pr.login_fails where at > now() - interval '15 minutes';
  if n >= 8 then return jsonb_build_object('error', 'محاولات كثيرة — جرّب بعد ربع ساعة'); end if;
  select v #>> '{}' into h from pr.settings where k = 'pin_hash';
  if h is null or h <> extensions.crypt(coalesce(p_pin, ''), h) then
    insert into pr.login_fails default values;
    return jsonb_build_object('error', 'الرمز غلط');
  end if;
  delete from pr.sessions where expires_at < now();
  insert into pr.sessions default values returning * into s;
  return jsonb_build_object('token', s.token);
end $$;

create or replace function public.pr_api(p_token uuid, p_action text, p jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ses pr.sessions; pid uuid; lid uuid; r jsonb; x jsonb; n int; pos0 int; q text; ids uuid[]; c pr.catalog; kc pr.costs;
begin
  select * into ses from pr.sessions where token = p_token and expires_at > now();
  if ses.token is null then return jsonb_build_object('error', 'session', 'msg', 'انتهت الجلسة — فوت من جديد'); end if;

  if p_action = 'projects' then
    return coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'code', p.code, 'name', p.name, 'client', p.client, 'site', p.site, 'trade', p.trade,
        'status', p.status, 'updated_at', p.updated_at, 'drawing_ref', p.drawing_ref,
        'lines', (select count(*) from pr.lines l where l.project_id = p.id),
        'open', (select count(*) from pr.lines l where l.project_id = p.id and l.status <> 'confirmed'),
        'total', (select coalesce(sum(l.qty * l.rate), 0) from pr.lines l where l.project_id = p.id))
      order by p.updated_at desc) from pr.projects p), '[]'::jsonb);

  elsif p_action = 'project' then
    return coalesce(pr.project_json((p ->> 'id')::uuid), jsonb_build_object('error', 'missing'));

  elsif p_action = 'save_project' then
    pid := nullif(p ->> 'id', '')::uuid;
    if pid is null then
      insert into pr.projects(name, client, site, trade, code, notes)
      values (coalesce(nullif(p ->> 'name', ''), 'مشروع جديد'), p ->> 'client', p ->> 'site', coalesce(p ->> 'trade', 'mep'), p ->> 'code', p ->> 'notes')
      returning id into pid;
    else
      update pr.projects set
        name = coalesce(p ->> 'name', name), client = coalesce(p ->> 'client', client), site = coalesce(p ->> 'site', site),
        trade = coalesce(p ->> 'trade', trade), code = coalesce(p ->> 'code', code), status = coalesce(p ->> 'status', status),
        notes = coalesce(p ->> 'notes', notes), validity_days = coalesce((p ->> 'validity_days')::int, validity_days),
        vat = coalesce((p ->> 'vat')::boolean, vat), discount_pct = coalesce((p ->> 'discount_pct')::numeric, discount_pct),
        updated_at = now()
      where id = pid;
    end if;
    return pr.project_json(pid);

  elsif p_action = 'delete_project' then
    delete from pr.projects where id = (p ->> 'id')::uuid;
    return jsonb_build_object('ok', true);

  elsif p_action = 'add_line' then
    pid := (p ->> 'project_id')::uuid;
    select coalesce(max(pos), 0) + 1 into pos0 from pr.lines where project_id = pid;
    if p ? 'catalog_key' and nullif(p ->> 'catalog_key', '') is not null then
      select * into c from pr.catalog where key = p ->> 'catalog_key';
      insert into pr.lines(project_id, pos, section, catalog_key, description, unit, qty)
      values (pid, pos0, p ->> 'section', c.key, coalesce(nullif(p ->> 'description', ''), c.name), coalesce(p ->> 'unit', c.unit),
              nullif(p ->> 'qty', '')::numeric)
      returning id into lid;
    elsif nullif(p ->> 'cost_id', '') is not null then
      select * into kc from pr.costs where id = p ->> 'cost_id';
      insert into pr.lines(project_id, pos, section, cost_id, description, unit, qty)
      values (pid, pos0, p ->> 'section', kc.id, kc.item, kc.unit, nullif(p ->> 'qty', '')::numeric)
      returning id into lid;
    else
      insert into pr.lines(project_id, pos, section, description, unit, qty, rate, status)
      values (pid, pos0, p ->> 'section', coalesce(nullif(p ->> 'description', ''), 'بند جديد'), p ->> 'unit',
              nullif(p ->> 'qty', '')::numeric, nullif(p ->> 'rate', '')::numeric,
              case when nullif(p ->> 'rate', '') is null then 'suggested' else 'confirmed' end)
      returning id into lid;
    end if;
    perform pr.refresh_line(lid);
    update pr.projects set updated_at = now() where id = pid;
    return pr.project_json(pid);

  elsif p_action = 'save_line' then
    lid := (p ->> 'id')::uuid;
    update pr.lines set
      description = coalesce(p ->> 'description', description), unit = coalesce(p ->> 'unit', unit),
      section = coalesce(p ->> 'section', section), note = coalesce(p ->> 'note', note),
      qty = case when p ? 'qty' then nullif(p ->> 'qty', '')::numeric else qty end,
      qty_note = case when p ? 'qty_note' then nullif(p ->> 'qty_note', '') else qty_note end,
      pos = coalesce((p ->> 'pos')::int, pos), updated_at = now()
    where id = lid returning project_id into pid;
    if p ? 'rate' then
      if nullif(p ->> 'rate', '') is null then
        update pr.lines set status = 'suggested' where id = lid;
        perform pr.refresh_line(lid);
      else
        update pr.lines set rate = (p ->> 'rate')::numeric, status = 'confirmed' where id = lid;
        perform pr.log_rate(lid);
      end if;
    end if;
    update pr.projects set updated_at = now() where id = pid;
    return pr.project_json(pid);

  elsif p_action = 'delete_line' then
    delete from pr.lines where id = (p ->> 'id')::uuid returning project_id into pid;
    return pr.project_json(pid);

  elsif p_action = 'confirm_all' then
    pid := (p ->> 'project_id')::uuid;
    select array_agg(id) into ids from pr.lines where project_id = pid and status = 'suggested' and rate is not null;
    update pr.lines set status = 'confirmed', updated_at = now() where id = any(coalesce(ids, '{}'));
    perform pr.log_rate(i) from unnest(coalesce(ids, '{}')) i;
    update pr.projects set updated_at = now() where id = pid;
    return pr.project_json(pid);

  elsif p_action = 'refresh' then
    pid := (p ->> 'project_id')::uuid;
    perform pr.refresh_line(id) from pr.lines where project_id = pid;
    return pr.project_json(pid);

  elsif p_action = 'catalog' then
    q := lower(coalesce(p ->> 'q', ''));
    return coalesce((select jsonb_agg(to_jsonb(x2) order by x2.trade, x2.key) from (
      select c2.*, pr.suggest(c2.key) as sug from pr.catalog c2
      where (q = '' or lower(c2.name || ' ' || coalesce(c2.name_ar, '') || ' ' || c2.key) like '%' || q || '%')
        and (coalesce(p ->> 'trade', '') = '' or c2.trade = p ->> 'trade')
      limit 300) x2), '[]'::jsonb);

  elsif p_action = 'save_catalog' then
    insert into pr.catalog(key, trade, name, name_ar, unit, cost_ids, cost_usd, cost_note, install_usd, markup_pct, est_rate, note)
    values (p ->> 'key', coalesce(p ->> 'trade', 'mep'), p ->> 'name', p ->> 'name_ar', coalesce(p ->> 'unit', 'no'),
            coalesce((select array_agg(v) from jsonb_array_elements_text(p -> 'cost_ids') v), '{}'),
            nullif(p ->> 'cost_usd', '')::numeric, p ->> 'cost_note', coalesce(nullif(p ->> 'install_usd', '')::numeric, 0),
            nullif(p ->> 'markup_pct', '')::numeric, nullif(p ->> 'est_rate', '')::numeric, p ->> 'note')
    on conflict (key) do update set
      trade = excluded.trade, name = excluded.name, name_ar = excluded.name_ar, unit = excluded.unit,
      cost_ids = case when p ? 'cost_ids' then excluded.cost_ids else pr.catalog.cost_ids end,
      cost_usd = excluded.cost_usd, cost_note = excluded.cost_note, install_usd = excluded.install_usd,
      markup_pct = excluded.markup_pct, est_rate = excluded.est_rate, note = excluded.note, updated_at = now();
    perform pr.refresh_line(id) from pr.lines where catalog_key = p ->> 'key' and status = 'suggested';
    return jsonb_build_object('ok', true, 'sug', pr.suggest(p ->> 'key'));

  elsif p_action = 'costs' then
    q := coalesce(p ->> 'q', '');
    return coalesce((select jsonb_agg(to_jsonb(k2)) from (
      select * from pr.costs
      where q = '' or (item || ' ' || coalesce(code, '') || ' ' || coalesce(supplier_name, '')) ilike all (
        select '%' || w || '%' from regexp_split_to_table(trim(q), '\s+') w)
      order by last_date desc nulls last limit 60) k2), '[]'::jsonb);

  elsif p_action = 'settings' then
    return jsonb_build_object('markup', (select v from pr.settings where k = 'markup'),
      'vat', (select v from pr.settings where k = 'vat'), 'history_days', (select v from pr.settings where k = 'history_days'),
      'costs', (select count(*) from pr.costs), 'synced', (select max(synced_at) from pr.costs),
      'rates', (select count(*) from pr.rates), 'catalog', (select count(*) from pr.catalog));

  elsif p_action = 'save_settings' then
    if p ? 'markup' then update pr.settings set v = p -> 'markup' where k = 'markup'; end if;
    if p ? 'history_days' then update pr.settings set v = p -> 'history_days' where k = 'history_days'; end if;
    if nullif(p ->> 'new_pin', '') is not null then
      if length(p ->> 'new_pin') < 4 then return jsonb_build_object('error', 'الرمز لازم يكون 4 أرقام أو أكتر'); end if;
      update pr.settings set v = to_jsonb(extensions.crypt(p ->> 'new_pin', extensions.gen_salt('bf'))) where k = 'pin_hash';
    end if;
    perform pr.refresh_line(id) from pr.lines where status = 'suggested';
    return jsonb_build_object('ok', true);

  elsif p_action = 'import_boq' then
    -- from the shop-drawings engine: {drawing_ref, name, client, site, trade, lines:[{key, description, unit, qty, qty_note, section}]}
    insert into pr.projects(name, client, site, trade, drawing_ref)
    values (p ->> 'name', p ->> 'client', p ->> 'site', coalesce(p ->> 'trade', 'mep'), p ->> 'drawing_ref')
    on conflict (drawing_ref) do update set name = excluded.name, client = coalesce(excluded.client, pr.projects.client),
      site = coalesce(excluded.site, pr.projects.site), updated_at = now()
    returning id into pid;
    ids := '{}'; n := 0;
    for x in select * from jsonb_array_elements(p -> 'lines') loop
      n := n + 1;
      select id into lid from pr.lines
        where project_id = pid and not (id = any(ids))
          and ((nullif(x ->> 'key', '') is not null and catalog_key = x ->> 'key') or description = x ->> 'description')
        order by (catalog_key is not distinct from nullif(x ->> 'key', '')) desc limit 1;
      if lid is null then
        insert into pr.lines(project_id, pos, section, catalog_key, description, unit, qty, qty_note)
        values (pid, n, x ->> 'section', (select key from pr.catalog where key = x ->> 'key'), x ->> 'description',
                x ->> 'unit', nullif(x ->> 'qty', '')::numeric, nullif(x ->> 'qty_note', ''))
        returning id into lid;
      else
        update pr.lines set pos = n, section = x ->> 'section', description = x ->> 'description', unit = x ->> 'unit',
          qty = nullif(x ->> 'qty', '')::numeric, qty_note = nullif(x ->> 'qty_note', ''), updated_at = now()
        where id = lid;
      end if;
      ids := ids || lid;
      perform pr.refresh_line(lid);
    end loop;
    delete from pr.lines where project_id = pid and not (id = any(ids)) and status = 'suggested';
    update pr.lines set note = 'انشال من الخرائط' where project_id = pid and not (id = any(ids));
    return pr.project_json(pid);
  end if;

  return jsonb_build_object('error', 'unknown action');
end $$;

revoke all on function public.pr_api(uuid, text, jsonb) from public;
revoke all on function public.pr_login(text) from public;
grant execute on function public.pr_api(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.pr_login(text) to anon, authenticated;
