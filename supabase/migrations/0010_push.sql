-- 0010: phone notifications (Web Push). Only adds tables and functions; no existing record changes.
-- A browser that says yes gets a subscription (an address at Google / Apple / Mozilla / Microsoft push services).
-- It is kept here, and the `push` Edge Function sends short notices to it, signed with this app's VAPID key, which
-- the function creates once and keeps in Vault. A notice is only sent for something that really happened (checked
-- here against the data), once per event, and a sender can set off at most 30 in ten minutes.

create table if not exists private.push_subs (
  endpoint text primary key,
  acct uuid not null,
  p256dh text not null,
  auth text not null,
  lang text not null default 'ko',
  off boolean not null default false,       -- switched off, gone at the push service, or replaced by newer devices
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create index if not exists push_subs_acct on private.push_subs (acct) where not off;
create table if not exists private.push_log (
  to_acct uuid not null,                    -- the zero id: a notice to everyone
  kind text not null,
  ref text not null,
  from_uid uuid,
  created_at timestamptz not null default now(),
  primary key (to_acct, kind, ref)
);
create index if not exists push_log_from on private.push_log (from_uid, created_at);
revoke all on private.push_subs, private.push_log from public, anon, authenticated;

/* ---- the browser: switch notices on / off for this device ---- */
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_lang text default 'ko') returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_acct uuid := public.acct();
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if p_endpoint is null or length(p_endpoint) > 1000
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
  then raise exception 'bad_endpoint'; end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{86,88}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{21,24}$' then raise exception 'bad_keys'; end if;
  insert into private.push_subs (endpoint, acct, p256dh, auth, lang)
  values (p_endpoint, v_acct, p_p256dh, p_auth, case when p_lang in ('ko', 'en', 'ja', 'zh') then p_lang else 'ko' end)
  on conflict (endpoint) do update set acct = excluded.acct, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang, off = false, seen_at = now();
  -- at most 10 devices per account: older ones stop getting notices
  update private.push_subs s set off = true
   where s.acct = v_acct and not s.off
     and s.endpoint in (select x.endpoint from private.push_subs x where x.acct = v_acct and not x.off order by x.seen_at desc offset 10);
  return true;
end $$;
create or replace function public.push_unsubscribe(p_endpoint text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  update private.push_subs s set off = true where s.endpoint = p_endpoint and public.acct_of(s.acct) = public.acct();
  return found;
end $$;
create or replace function public.push_is_on(p_endpoint text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.push_subs s where s.endpoint = p_endpoint and not s.off and public.acct_of(s.acct) = public.acct());
$$;

/* ---- the push function (service role only) ---- */
-- the VAPID key pair: { pub, jwk } in Vault; made once by the function
create or replace function public.push_vapid() returns jsonb
language sql stable security definer set search_path = '' as $$
  select (select s.decrypted_secret::jsonb from vault.decrypted_secrets s where s.name = 'zzirit_vapid' order by s.created_at limit 1);
$$;
create or replace function public.push_vapid_init(p_keys jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('zzirit_vapid'));
  select s.decrypted_secret::jsonb into v from vault.decrypted_secrets s where s.name = 'zzirit_vapid' order by s.created_at limit 1;
  if v is not null then return v; end if;       -- someone else made it first: use that one
  if p_keys is null or coalesce(p_keys ->> 'pub', '') !~ '^[A-Za-z0-9_-]{86,88}$' or jsonb_typeof(p_keys -> 'jwk') <> 'object' then raise exception 'bad_keys'; end if;
  perform vault.create_secret(p_keys::text, 'zzirit_vapid', 'Web Push (VAPID) key pair for ZZIRIT notifications');
  return p_keys;
end $$;

-- is this event real, and who should hear about it? null = nothing to send
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
  end if;
  return null;
end $$;
-- once per event; at most 30 from one sender in ten minutes
create or replace function public.push_once(p_to uuid, p_kind text, p_ref text, p_from uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_from is not null then
    select count(*) into n from private.push_log l where l.from_uid = p_from and l.created_at > now() - interval '10 minutes';
    if n >= 30 then return false; end if;
  end if;
  insert into private.push_log (to_acct, kind, ref, from_uid) values (p_to, p_kind, left(p_ref, 120), p_from) on conflict do nothing;
  return found;
end $$;
-- where to send: the account's devices (the zero id: every device that said yes)
create or replace function public.push_targets(p_acct uuid) returns table (endpoint text, p256dh text, auth text, lang text)
language sql stable security definer set search_path = '' as $$
  select s.endpoint, s.p256dh, s.auth, s.lang from private.push_subs s
   where not s.off and (p_acct = '00000000-0000-0000-0000-000000000000'::uuid or public.acct_of(s.acct) = public.acct_of(p_acct))
   order by s.seen_at desc
   limit case when p_acct = '00000000-0000-0000-0000-000000000000'::uuid then 5000 else 10 end;
$$;
-- the push service says this address is gone (404 / 410)
create or replace function public.push_gone(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
  update private.push_subs set off = true where endpoint = p_endpoint;
$$;

revoke all on function public.push_subscribe(text, text, text, text), public.push_unsubscribe(text), public.push_is_on(text) from public, anon;
grant execute on function public.push_subscribe(text, text, text, text), public.push_unsubscribe(text), public.push_is_on(text) to authenticated;
revoke all on function public.push_vapid(), public.push_vapid_init(jsonb), public.push_check(uuid, text, text),
  public.push_once(uuid, text, text, uuid), public.push_targets(uuid), public.push_gone(text) from public, anon, authenticated;
grant execute on function public.push_vapid(), public.push_vapid_init(jsonb), public.push_check(uuid, text, text),
  public.push_once(uuid, text, text, uuid), public.push_targets(uuid), public.push_gone(text) to service_role;
