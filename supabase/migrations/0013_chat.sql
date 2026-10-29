-- 0013: live chat — the open chat for everyone online and 1:1 chat between friends — with the operator's tools for it
-- (hide a message, mute someone for a while), the operator deleting a board post or comment for good, and phone notices
-- for 1:1 messages. Only adds and updates; nothing is removed.

/* ---------- 1. who is friends with whom (the same rule the app uses: both sides want it, the accept is newer) ---------- */
create or replace function private.are_friends(p_x uuid, p_y uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare xy jsonb; yx jsonb; tx numeric; ty numeric;
begin
  if p_x is null or p_y is null or p_x = p_y then return false; end if;
  select a.data -> 'fr' -> (p_y::text) into xy from public.anglers a where a.id = p_x;
  select a.data -> 'fr' -> (p_x::text) into yx from public.anglers a where a.id = p_y;
  if coalesce(jsonb_typeof(xy), '') <> 'array' or coalesce(jsonb_typeof(yx), '') <> 'array' then return false; end if;
  if coalesce(xy ->> 0, '') not in ('r', 'a') or coalesce(yx ->> 0, '') not in ('r', 'a') then return false; end if;
  tx := case when jsonb_typeof(xy -> 1) = 'number' then (xy ->> 1)::numeric else 0 end;
  ty := case when jsonb_typeof(yx -> 1) = 'number' then (yx ->> 1)::numeric else 0 end;
  if xy ->> 0 = 'a' and yx ->> 0 = 'r' then return tx >= ty; end if;
  if xy ->> 0 = 'r' and yx ->> 0 = 'a' then return ty >= tx; end if;
  return true;
end $$;
revoke all on function private.are_friends(uuid, uuid) from public, anon, authenticated;

/* ---------- 2. muting: the operator can keep someone out of the chat for a while (ending it just moves the time) ---------- */
create table if not exists private.chat_mutes (
  acct uuid primary key references auth.users(id) on delete cascade,
  until timestamptz not null,
  by_uid uuid,
  created_at timestamptz not null default now()
);
revoke all on private.chat_mutes from public, anon, authenticated;

/* ---------- 3. the open chat: a profile, not muted, not too fast, no links or phone numbers; kept 3 days for reading ---------- */
create table if not exists public.chat (
  id bigint generated always as identity primary key,
  room text not null default 'all' check (room ~ '^[a-z0-9]{1,16}$'),
  uid uuid not null references auth.users(id) on delete cascade,
  nick text not null default '',
  body text not null check (char_length(body) between 1 and 200),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists chat_room_id on public.chat (room, id desc);
create or replace function private.chat_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); v_nick text; v_body text;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  select a.data ->> 'nick' into v_nick from public.anglers a where a.id = v_acct;
  if coalesce(btrim(v_nick), '') = '' then raise exception 'no_profile'; end if;
  if exists (select 1 from private.chat_mutes m where m.acct = v_acct and m.until > now()) then raise exception 'muted'; end if;
  v_body := btrim(regexp_replace(coalesce(new.body, ''), '\s+', ' ', 'g'));
  if char_length(v_body) < 1 or char_length(v_body) > 200 then raise exception 'bad_body'; end if;
  -- the open chat is for talking here: no links (spam, scams) and no phone numbers (people's safety)
  if v_body ~* '(https?://|www\.|[a-z0-9-]+\.(com|net|org|kr|io|me|ly|gg|co)(/|$|[^a-z]))' then raise exception 'no_links'; end if;
  if v_body ~ '01[016789][ .-]?[0-9]{3,4}[ .-]?[0-9]{4}' then raise exception 'no_phone'; end if;
  if not private.try_ok('chat:' || v_acct::text, 6, interval '15 seconds') then raise exception 'slow_down'; end if;
  if not private.try_ok('chatm:' || v_acct::text, 60, interval '10 minutes') then raise exception 'slow_down'; end if;
  new.uid := v_acct; new.nick := left(btrim(v_nick), 16); new.body := v_body; new.hidden := false; new.created_at := now();
  return new;
end $$;
revoke all on function private.chat_guard() from public, anon, authenticated;
alter table public.chat enable row level security;
do $$ begin
  if not exists (select 1 from pg_trigger t where t.tgname = 'chat_guard' and t.tgrelid = 'public.chat'::regclass) then
    create trigger chat_guard before insert on public.chat for each row execute function private.chat_guard();
  end if;
  if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'chat' and p.policyname = 'chat read') then
    create policy "chat read" on public.chat for select to authenticated
      using ((not hidden or (select public.is_admin())) and created_at > now() - interval '3 days');
  end if;
  if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'chat' and p.policyname = 'chat add') then
    create policy "chat add" on public.chat for insert to authenticated with check (uid = (select public.acct()));
  end if;
end $$;
revoke all on public.chat from anon, authenticated;
grant select, insert on public.chat to authenticated;

/* ---------- 4. 1:1 chat between friends: only the two of them can read it ---------- */
create table if not exists public.dm (
  id bigint generated always as identity primary key,
  a uuid not null references auth.users(id) on delete cascade,
  b uuid not null references auth.users(id) on delete cascade,
  sender uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  constraint dm_pair check (a < b),
  constraint dm_sender check (sender = a or sender = b)
);
create index if not exists dm_a_id on public.dm (a, id desc);
create index if not exists dm_b_id on public.dm (b, id desc);
create or replace function private.dm_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_me uuid := public.acct(); v_peer uuid; v_body text;
begin
  if auth.uid() is null or v_me is null then raise exception 'not_signed_in'; end if;
  -- the app names the pair (me — my account or this device — and the friend) in a and b in any order
  v_peer := case when new.a in (v_me, auth.uid()) then new.b when new.b in (v_me, auth.uid()) then new.a else null end;
  if v_peer is null then raise exception 'bad_peer'; end if;
  v_peer := public.acct_of(v_peer);
  if v_peer = v_me then raise exception 'bad_peer'; end if;
  if not private.are_friends(v_me, v_peer) then raise exception 'not_friends'; end if;
  if exists (select 1 from private.chat_mutes m where m.acct = v_me and m.until > now()) then raise exception 'muted'; end if;
  v_body := btrim(coalesce(new.body, ''));
  if char_length(v_body) < 1 or char_length(v_body) > 500 then raise exception 'bad_body'; end if;
  if not private.try_ok('dm:' || v_me::text, 10, interval '20 seconds') then raise exception 'slow_down'; end if;
  new.a := least(v_me, v_peer); new.b := greatest(v_me, v_peer); new.sender := v_me; new.body := v_body; new.created_at := now();
  return new;
end $$;
revoke all on function private.dm_guard() from public, anon, authenticated;
alter table public.dm enable row level security;
do $$ begin
  if not exists (select 1 from pg_trigger t where t.tgname = 'dm_guard' and t.tgrelid = 'public.dm'::regclass) then
    create trigger dm_guard before insert on public.dm for each row execute function private.dm_guard();
  end if;
  if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'dm' and p.policyname = 'dm read') then
    create policy "dm read" on public.dm for select to authenticated using ((select public.acct()) in (a, b));
  end if;
  if not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = 'dm' and p.policyname = 'dm add') then
    create policy "dm add" on public.dm for insert to authenticated with check (sender = (select public.acct()));
  end if;
end $$;
revoke all on public.dm from anon, authenticated;
grant select, insert on public.dm to authenticated;

/* ---------- 5. live updates for both ---------- */
do $$ begin
  if not exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'chat') then
    alter publication supabase_realtime add table public.chat;
  end if;
  if not exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.schemaname = 'public' and p.tablename = 'dm') then
    alter publication supabase_realtime add table public.dm;
  end if;
end $$;

/* ---------- 6. the operator: hide a message, mute someone (0 minutes ends it), see who is muted; my own mute ---------- */
create or replace function public.chat_hide(p_id bigint, p_on boolean default true) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  update public.chat c set hidden = coalesce(p_on, true) where c.id = p_id;
  return found;
end $$;
create or replace function public.chat_mute(p_uid uuid, p_minutes int) returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare v_until timestamptz;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_uid is null then return null; end if;
  p_uid := public.acct_of(p_uid);
  if p_uid = public.acct() then raise exception 'cannot_mute_self'; end if;
  v_until := now() + make_interval(mins => greatest(0, least(coalesce(p_minutes, 0), 60 * 24 * 30)));
  insert into private.chat_mutes (acct, until, by_uid) values (p_uid, v_until, auth.uid())
  on conflict (acct) do update set until = excluded.until, by_uid = excluded.by_uid, created_at = now();
  return v_until;
end $$;
create or replace function public.chat_mutes() returns table (acct uuid, until timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query select m.acct, m.until from private.chat_mutes m where m.until > now() order by m.until desc;
end $$;
create or replace function public.chat_my_mute() returns timestamptz
language sql stable security definer set search_path = '' as $$
  select m.until from private.chat_mutes m where m.acct = public.acct() and m.until > now();
$$;
revoke all on function public.chat_hide(bigint, boolean), public.chat_mute(uuid, int), public.chat_mutes(), public.chat_my_mute() from public, anon;
grant execute on function public.chat_hide(bigint, boolean), public.chat_mute(uuid, int), public.chat_mutes(), public.chat_my_mute() to authenticated;

/* ---------- 7. the operator deletes a board post or comment for good (it lives in its author's board doc) ---------- */
create or replace function public.board_admin_remove(p_owner uuid, p_kind text, p_id text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_col text; n int;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_owner is null or coalesce(p_id, '') = '' or p_kind not in ('post', 'cmt') then return false; end if;
  v_col := case when p_kind = 'post' then 'posts' else 'cmts' end;
  update public.board b
     set data = jsonb_set(b.data, array[v_col], coalesce((
       select jsonb_agg(x order by i) from jsonb_array_elements(b.data -> v_col) with ordinality as t(x, i)
        where x ->> 'id' is distinct from p_id), '[]'::jsonb))
   where b.id = p_owner and jsonb_typeof(b.data -> v_col) = 'array'
     and exists (select 1 from jsonb_array_elements(b.data -> v_col) x where x ->> 'id' = p_id);
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.board_admin_remove(uuid, text, text) from public, anon;
grant execute on function public.board_admin_remove(uuid, text, text) to authenticated;

/* ---------- 8. phone notices also for 1:1 messages (the same check as before, plus 'dm') ---------- */
create or replace function public.push_check(p_from uuid, p_kind text, p_ref text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from uuid := public.acct_of(p_from);
  v_recent bigint := (extract(epoch from now()) * 1000)::bigint - 15 * 60000;   -- the event happened in the last 15 minutes
  v_nick text; v_to uuid; v_title text; v_e jsonb;
begin
  if p_from is null or p_kind is null or p_ref is null or length(p_ref) > 120 then return null; end if;
  select a.data ->> 'nick' into v_nick from public.anglers a where a.id = v_from;
  if p_kind = 'cmt' then
    -- a reply to someone's post: ref = "authorAccount|postId", and my comment on it is fresh
    if p_ref !~ '^[0-9a-f-]{36}\|[A-Za-z0-9_-]{1,40}$' or v_nick is null then return null; end if;
    v_to := split_part(p_ref, '|', 1)::uuid;
    if v_to = v_from then return null; end if;
    if not exists (select 1 from public.board b, jsonb_array_elements(coalesce(b.data -> 'cmts', '[]'::jsonb)) c
                    where b.id = v_from and c ->> 'p' = p_ref and coalesce((c ->> 'ts')::bigint, 0) > v_recent) then return null; end if;
    select p ->> 'title' into v_title from public.board b, jsonb_array_elements(coalesce(b.data -> 'posts', '[]'::jsonb)) p
     where b.id = v_to and p ->> 'id' = split_part(p_ref, '|', 2) limit 1;
    if v_title is null then return null; end if;
    return jsonb_build_object('to', v_to, 'nick', v_nick, 'title', left(v_title, 40), 'url', '#board');
  elsif p_kind in ('freq', 'facc') then
    -- a friend request / an accepted request: ref = the other person's account
    if p_ref !~ '^[0-9a-f-]{36}$' or v_nick is null then return null; end if;
    v_to := public.acct_of(p_ref::uuid);
    if v_to = v_from then return null; end if;
    select a.data -> 'fr' -> (v_to::text) into v_e from public.anglers a where a.id = v_from;
    if v_e is null or jsonb_typeof(v_e) <> 'array' or coalesce((v_e ->> 1)::bigint, 0) < v_recent then return null; end if;
    if p_kind = 'freq' and (v_e ->> 0 <> 'r' or coalesce((select (a.data ->> 'frOff')::boolean from public.anglers a where a.id = v_to), false)) then return null; end if;
    if p_kind = 'facc' and (v_e ->> 0 <> 'a' or coalesce((select a.data -> 'fr' -> (v_from::text) ->> 0 from public.anglers a where a.id = v_to), '') <> 'r') then return null; end if;
    return jsonb_build_object('to', v_to, 'nick', v_nick, 'url', '#friends');
  elsif p_kind = 'tjoin' then
    -- asking to join a team that needs the leader's yes: ref = the leader's account
    if p_ref !~ '^[0-9a-f-]{36}$' or v_nick is null then return null; end if;
    v_to := p_ref::uuid;
    if v_to = v_from then return null; end if;
    if not exists (select 1 from public.anglers a where a.id = v_from and a.data -> 'team' ->> 'id' = v_to::text
                    and coalesce((a.data -> 'team' ->> 'ts')::bigint, 0) > v_recent) then return null; end if;
    if not exists (select 1 from public.teams t where t.id = v_to and not coalesce((t.data ->> 'open')::boolean, false)) then return null; end if;
    return jsonb_build_object('to', v_to, 'nick', v_nick, 'url', '#teams');
  elsif p_kind = 'notice' then
    -- the operator's notice, to everyone who switched notices on
    if not exists (select 1 from public.app_admins x where x.uid = p_from or x.uid = v_from) then return null; end if;
    select g.data -> 'notice' into v_e from public.admin_docs g where g.id = 'config';
    if v_e is null or v_e ->> 'id' is distinct from p_ref then return null; end if;
    return jsonb_build_object('to', '00000000-0000-0000-0000-000000000000', 'all', true, 'body', left(v_e ->> 't', 140), 'url', '#home');
  elsif p_kind = 'paid' then
    -- the operator confirmed a payment: ref = "buyerAccount|orderId"
    if not exists (select 1 from public.app_admins x where x.uid = p_from or x.uid = v_from) then return null; end if;
    if p_ref !~ '^[0-9a-f-]{36}\|[A-Za-z0-9_-]{1,40}$' then return null; end if;
    v_to := split_part(p_ref, '|', 1)::uuid;
    if coalesce((select g.data -> (v_to::text) ->> split_part(p_ref, '|', 2) from public.admin_docs g where g.id = 'grants'), '') <> 'ok' then return null; end if;
    return jsonb_build_object('to', v_to, 'url', '#sea');
  elsif p_kind = 'verdict' then
    -- the operator decided on a catch by hand: ref = "ownerAccount|catchId"
    if not exists (select 1 from public.app_admins x where x.uid = p_from or x.uid = v_from) then return null; end if;
    if p_ref !~ '^[0-9a-f-]{36}\|[A-Za-z0-9_-]{1,40}$' then return null; end if;
    v_to := split_part(p_ref, '|', 1)::uuid;
    select g.data -> (v_to::text) ->> split_part(p_ref, '|', 2) into v_title from public.admin_docs g where g.id = 'verdicts';
    if v_title is null or v_title not in ('ok', 'no') then return null; end if;
    select c into v_e from public.anglers a, jsonb_array_elements(coalesce(a.data -> 'catches', '[]'::jsonb)) c
     where a.id = v_to and c ->> 'id' = split_part(p_ref, '|', 2) limit 1;
    if v_e is null then return null; end if;
    return jsonb_build_object('to', v_to, 'v', v_title, 'sp', v_e ->> 'sp', 'len', v_e -> 'len', 'url', '#log',
      'ko', (select n.ko from private.species_names n where n.id = v_e ->> 'sp'), 'en', (select n.en from private.species_names n where n.id = v_e ->> 'sp'));
  elsif p_kind = 'dm' then
    -- a 1:1 message I sent in the last 15 minutes: ref = the message id
    if p_ref !~ '^[0-9]{1,18}$' or v_nick is null then return null; end if;
    select case when d.a = v_from then d.b else d.a end into v_to from public.dm d
     where d.id = p_ref::bigint and d.sender = v_from and d.created_at > now() - interval '15 minutes';
    if v_to is null then return null; end if;
    return jsonb_build_object('to', v_to, 'nick', v_nick, 'url', '#chat');
  end if;
  return null;
end $$;
revoke all on function public.push_check(uuid, text, text) from public, anon, authenticated;
grant execute on function public.push_check(uuid, text, text) to service_role;
