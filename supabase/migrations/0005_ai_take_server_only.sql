-- Only the AI function (secret key) may spend the AI budget, so nobody can drain it by calling the RPC directly.
drop function if exists public.ai_take(text);
create or replace function public.ai_take(p_uid uuid, p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'Asia/Seoul')::date;
  v_lim int; v_glim int; v_mine int; v_total int;
begin
  if p_uid is null then return false; end if;
  if p_kind = 'image' then v_lim := 30; v_glim := 1000;
  elsif p_kind = 'text' then v_lim := 40; v_glim := 2000;
  else return false; end if;
  select coalesce((select u.n from public.ai_usage u where u.uid = p_uid and u.day = v_day and u.kind = p_kind), 0) into v_mine;
  if v_mine >= v_lim then return false; end if;
  insert into public.ai_usage as u (uid, day, kind, n) values ('00000000-0000-0000-0000-000000000000', v_day, p_kind, 1)
    on conflict on constraint ai_usage_pkey do update set n = u.n + 1 returning u.n into v_total;
  if v_total > v_glim then return false; end if;
  insert into public.ai_usage as u (uid, day, kind, n) values (p_uid, v_day, p_kind, 1)
    on conflict on constraint ai_usage_pkey do update set n = u.n + 1;
  return true;
end $$;
revoke all on function public.ai_take(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_take(uuid, text) to service_role;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
