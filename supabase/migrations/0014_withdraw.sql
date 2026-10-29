-- 0014: leaving ZZIRIT (회원 탈퇴). Someone removes their own account: the profile, catches, photos, posts and comments,
-- friends, team, login ID, fishing points, chat and 1:1 messages, phone notices — on every device linked to the account.
-- With a login ID the password is asked again. An operator account can't remove itself this way (no one would be left
-- to run the app by mistake). Run in the Supabase SQL editor: removing the sign-in is a DELETE.

create or replace function public.delete_my_account(p_pass text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_ids uuid[]; v_id uuid; v_login private.logins%rowtype;
begin
  if auth.uid() is null or v_acct is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  if exists (select 1 from public.app_admins x where x.uid = auth.uid() or x.uid = v_acct) then return jsonb_build_object('ok', false, 'err', 'admin'); end if;
  if not private.try_ok('del:' || auth.uid()::text, 5, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  v_login := private.login_of(v_acct);
  if v_login.name is not null and (p_pass is null or v_login.pass <> extensions.crypt(p_pass, v_login.pass)) then
    perform pg_sleep(0.3);
    return jsonb_build_object('ok', false, 'err', 'wrong');
  end if;
  -- the account and every device linked to it
  select array_agg(x) into v_ids from (select v_acct as x union select l.member from private.links l where l.owner = v_acct) q;
  foreach v_id in array v_ids loop
    -- what other people keep about them: friend edges, team rosters, operator notes
    update public.anglers a set data = jsonb_set(a.data, '{fr}', (a.data -> 'fr') - v_id::text) where jsonb_typeof(a.data -> 'fr') = 'object' and a.data -> 'fr' ? v_id::text;
    update public.teams tm set data = jsonb_set(tm.data, '{members}', (tm.data -> 'members') - v_id::text) where jsonb_typeof(tm.data -> 'members') = 'object' and tm.data -> 'members' ? v_id::text;
    update public.anglers a set data = a.data - 'team' where a.data #>> '{team,id}' = v_id::text;
    update public.admin_docs g set data = g.data - v_id::text where g.data ? v_id::text;
  end loop;
  -- removing the sign-ins removes everything else with them
  delete from auth.users u where u.id = any(v_ids);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;
