-- Server-side checks on every angler save (variables prefixed to avoid clashing with column names)
create or replace function private.anglers_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old_map jsonb := '{}'::jsonb;
  v_out jsonb := '[]'::jsonb;
  v_c jsonb; v_o jsonb;
  v_cid text; v_sp text; v_st text;
  v_len numeric; v_ts_ms numeric; v_ts timestamptz; v_tr int;
  v_past boolean; v_rel boolean; v_verified boolean; v_featured boolean;
  v_tk uuid; v_ticket public.ai_tickets%rowtype;
  v_lat double precision; v_lon double precision; v_clat double precision; v_clon double precision;
  v_past_count int := 0; v_past_allow int; v_credits int;
  v_keep text[] := '{}';
  v_feat text[] := private.featured_species(now());
  v_now_m text := to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM');
  v_n int := 0;
begin
  if jsonb_typeof(new.data) <> 'object' then raise exception 'bad_doc'; end if;
  if pg_column_size(new.data) > 900000 then raise exception 'doc_too_large'; end if;
  new.updated_at := now();
  if tg_op = 'UPDATE' and jsonb_typeof(old.data->'catches') = 'array' then
    select coalesce(jsonb_object_agg(x->>'id', x), '{}'::jsonb) into v_old_map
    from jsonb_array_elements(old.data->'catches') x where jsonb_typeof(x) = 'object' and x ? 'id';
  end if;
  if length(coalesce(new.data->>'nick', '')) > 24 then
    new.data := jsonb_set(new.data, '{nick}', to_jsonb(left(new.data->>'nick', 24)));
  end if;
  if new.data ? 'fr' and jsonb_typeof(new.data->'fr') <> 'object' then new.data := new.data - 'fr'; end if;

  -- past catches: 5 free + purchased credits the operator has not rejected
  select coalesce(sum(case when jsonb_typeof(it->'qty') = 'number' then (it->>'qty')::int else 1 end), 0) into v_credits
  from public.orders ord, jsonb_array_elements(coalesce(ord.data->'items', '[]'::jsonb)) it
  where ord.id = new.id and it->>'kind' = 'past'
    and coalesce((select g.data #>> array[new.id::text, it->>'id'] from public.admin_docs g where g.id = 'grants'), '') <> 'no';
  v_past_allow := 5 + v_credits;

  if jsonb_typeof(new.data->'catches') = 'array' then
    for v_c in select value from jsonb_array_elements(new.data->'catches') loop
      v_n := v_n + 1;
      exit when v_n > 3000;
      if jsonb_typeof(v_c) <> 'object' or not (v_c ? 'id') then continue; end if;
      v_cid := left(v_c->>'id', 40);
      v_keep := v_keep || v_cid;
      -- precise location goes to the private table; the public copy keeps the 0.25° grid cell
      v_lat := case when jsonb_typeof(v_c->'lat') = 'number' then (v_c->>'lat')::double precision end;
      v_lon := case when jsonb_typeof(v_c->'lon') = 'number' then (v_c->>'lon')::double precision end;
      if v_lat is not null and v_lon is not null and abs(v_lat) <= 90 and abs(v_lon) <= 180 then
        v_clat := (floor(v_lat / 0.25) + 0.5) * 0.25;
        v_clon := (floor(v_lon / 0.25) + 0.5) * 0.25;
        if v_lat <> v_clat or v_lon <> v_clon then
          insert into public.spots as s (uid, cid, lat, lon)
          values (new.id, v_cid, round(v_lat::numeric, 2), round(v_lon::numeric, 2))
          on conflict (uid, cid) do update set lat = excluded.lat, lon = excluded.lon;
        end if;
        v_c := jsonb_set(jsonb_set(v_c, '{lat}', to_jsonb(v_clat)), '{lon}', to_jsonb(v_clon));
      elsif v_c ? 'lat' or v_c ? 'lon' then
        v_c := jsonb_set(jsonb_set(v_c, '{lat}', 'null'::jsonb), '{lon}', 'null'::jsonb);
      end if;
      v_past := coalesce(v_c->'past' = 'true'::jsonb, false);
      v_o := v_old_map->v_cid;
      if v_o is not null and v_o = v_c then
        v_out := v_out || jsonb_build_array(v_o);
        if v_past and coalesce(v_o->>'st', '') <> 'no' then v_past_count := v_past_count + 1; end if;
        continue;
      end if;

      -- new or edited catch: check it again on the server
      v_sp := v_c->>'sp';
      v_len := case when jsonb_typeof(v_c->'len') = 'number' then (v_c->>'len')::numeric end;
      v_ts_ms := case when jsonb_typeof(v_c->'ts') = 'number' then (v_c->>'ts')::numeric end;
      v_ts := case when v_ts_ms is not null and v_ts_ms between 0 and 32503680000000 then to_timestamp(v_ts_ms / 1000.0) end;
      v_tr := case when jsonb_typeof(v_c->'tr') = 'number' then greatest(0, least(100, round((v_c->>'tr')::numeric)::int)) else 0 end;
      v_rel := coalesce(v_c->'rel' = 'true'::jsonb, false);
      v_st := coalesce(v_c->>'st', 'review');
      if v_st not in ('ok', 'review', 'no') then v_st := 'review'; end if;
      if (v_len is null or v_len <= 0 or v_len > 1000 or v_ts is null or v_ts > now() + interval '1 day') and v_st = 'ok' then v_st := 'review'; end if;

      -- 'ok' needs an unused AI screening ticket issued to this angler
      v_ticket := null; v_tk := null;
      begin v_tk := (v_c->>'tk')::uuid; exception when others then v_tk := null; end;
      if v_tk is not null then
        select * into v_ticket from public.ai_tickets t
        where t.nonce = v_tk and t.uid = new.id and (t.used_by is null or t.used_by = v_cid);
      end if;
      if v_st = 'ok' then
        if v_ticket.nonce is null or v_ticket.verdict is distinct from 'pass' or v_ticket.fish is false then
          v_st := 'review';
        elsif v_ticket.ai_len is not null and v_ticket.ai_len > 0 and v_len is not null
              and abs(v_len - v_ticket.ai_len::numeric) / v_ticket.ai_len::numeric > 0.5 then
          v_st := 'review';   -- typed length far from what the photo shows
        elsif v_ticket.img_hash is not null and exists (
              select 1 from public.ai_tickets t2
              where t2.img_hash = v_ticket.img_hash and t2.nonce <> v_ticket.nonce and t2.used_by is not null) then
          v_st := 'review';   -- the same photo was already used for another catch
        end if;
      end if;
      if v_ticket.nonce is not null then
        update public.ai_tickets t set used_by = v_cid where t.nonce = v_ticket.nonce;
      end if;
      if v_past and v_st <> 'no' then
        v_past_count := v_past_count + 1;
        if v_past_count > v_past_allow and v_st = 'ok' then v_st := 'review'; end if;
      end if;
      v_verified := v_ticket.nonce is not null and v_tr >= 70;
      v_featured := (not v_past) and v_sp = any(v_feat) and v_ts is not null
                    and to_char(v_ts at time zone 'Asia/Seoul', 'YYYY-MM') = v_now_m;
      v_c := v_c || jsonb_build_object('st', v_st, 'tr', v_tr,
        'sc', case when v_len is null or v_len <= 0 then 0
                   else private.score_of(v_sp, least(v_len, 1000), v_rel, v_verified, coalesce(v_featured, false)) end);
      v_out := v_out || jsonb_build_array(v_c);
    end loop;
    new.data := jsonb_set(new.data, '{catches}', v_out);
  end if;
  delete from public.spots s where s.uid = new.id and not (s.cid = any(v_keep));
  return new;
end $$;
