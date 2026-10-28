-- Daily AI budget per angler and for the whole app (parameter referenced as ai_take.kind to avoid clashing with the column)
create or replace function public.ai_take(kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_me uuid := auth.uid();
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_lim int; v_glim int; v_mine int; v_total int;
begin
  if v_me is null then return false; end if;
  if ai_take.kind = 'image' then v_lim := 30; v_glim := 1000;
  elsif ai_take.kind = 'text' then v_lim := 40; v_glim := 2000;
  else return false; end if;
  insert into public.ai_usage as u (uid, day, kind, n) values (v_me, v_day, ai_take.kind, 1)
    on conflict on constraint ai_usage_pkey do update set n = u.n + 1 returning u.n into v_mine;
  insert into public.ai_usage as u (uid, day, kind, n) values ('00000000-0000-0000-0000-000000000000', v_day, ai_take.kind, 1)
    on conflict on constraint ai_usage_pkey do update set n = u.n + 1 returning u.n into v_total;
  return v_mine <= v_lim and v_total <= v_glim;
end $$;
