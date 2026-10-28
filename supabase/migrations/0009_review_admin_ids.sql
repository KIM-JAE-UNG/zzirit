-- 0009: the operator can delete an account (with every device linked to it and everything it posted).
-- (Login IDs, the reviewer's queue and fishing points went on earlier with 0007b, which changes no records.)

create or replace function public.admin_delete_user(p_uid uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_ids uuid[]; v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_uid is null then return false; end if;
  p_uid := public.acct_of(p_uid);
  -- the account you are using right now can't delete itself (another operator account can be deleted)
  if p_uid = public.acct() then raise exception 'cannot_delete_self'; end if;
  -- the account and every device linked to it
  select array_agg(x) into v_ids from (select p_uid as x union select l.member from private.links l where l.owner = p_uid) q;
  foreach v_id in array v_ids loop
    -- references kept by other people: friend edges, team rosters, operator notes
    update public.anglers a set data = jsonb_set(a.data, '{fr}', (a.data->'fr') - v_id::text) where jsonb_typeof(a.data->'fr') = 'object' and a.data->'fr' ? v_id::text;
    update public.teams tm set data = jsonb_set(tm.data, '{members}', (tm.data->'members') - v_id::text) where jsonb_typeof(tm.data->'members') = 'object' and tm.data->'members' ? v_id::text;
    update public.anglers a set data = a.data - 'team' where a.data #>> '{team,id}' = v_id::text;
    update public.admin_docs g set data = g.data - v_id::text where g.data ? v_id::text;
  end loop;
  -- removing the sign-in removes the rest (profile, catches, photos, posts, team, orders, login ID, points, links, operator rights)
  delete from auth.users u where u.id = any(v_ids);
  return true;
end $$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
