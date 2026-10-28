-- 0007b: everything that can go on without touching anyone's records:
--   login ID + password, operator help for IDs and lost accounts, order rules, the automatic reviewer's queue,
--   and fishing points (포인트) people can write down and share.
-- Logging in with an ID, and the operator's recovery code, join a device to an account through the existing
-- link-code redemption (link_redeem) — the same merge the 8-character device code already does.

/* ---------- 1. orders: saved orders never change; only the two premium items or a tip; at most 3 waiting ---------- */
create or replace function private.orders_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_grants jsonb := coalesce((select g.data -> new.id::text from public.admin_docs g where g.id = 'grants'), '{}'::jsonb);
  v_old jsonb := case when tg_op = 'UPDATE' and jsonb_typeof(old.data->'items') = 'array' then old.data->'items' else '[]'::jsonb end;
  v_in jsonb := case when jsonb_typeof(new.data->'items') = 'array' then new.data->'items' else '[]'::jsonb end;
  v_app boolean := current_user in ('authenticated', 'anon');
  v_out jsonb := '[]'::jsonb; v_seen text[] := '{}'; v_wait_refs text[] := '{}';
  v_it jsonb; v_prev jsonb; v_id text; v_wait int := 0; v_n int := 0;
begin
  if pg_column_size(new.data) > 100000 then raise exception 'doc_too_large'; end if;
  if v_app then
    select count(*), coalesce(array_agg(o->>'ref') filter (where o->>'kind' = 'item'), '{}') into v_wait, v_wait_refs
    from jsonb_array_elements(v_old) o
    where jsonb_typeof(o) = 'object' and coalesce(v_grants ->> (o->>'id'), '') not in ('ok', 'no')
      and exists (select 1 from jsonb_array_elements(v_in) x where jsonb_typeof(x) = 'object' and x->>'id' = o->>'id');
  end if;
  for v_it in select value from jsonb_array_elements(v_in) loop
    v_n := v_n + 1; exit when v_n > 300;
    if jsonb_typeof(v_it) <> 'object' then continue; end if;
    v_id := left(coalesce(v_it->>'id', ''), 24);
    if v_id = '' or v_id = any(v_seen) then continue; end if;
    if v_app then
      v_prev := null;
      select o into v_prev from jsonb_array_elements(v_old) o where jsonb_typeof(o) = 'object' and o->>'id' = v_id limit 1;
      if v_prev is not null then
        v_it := v_prev;
      else
        if v_grants ? v_id then continue; end if;
        if not ((v_it->>'kind' = 'item' and v_it->>'ref' in ('pr_gold', 'th_palace')) or v_it->>'kind' = 'donate') then continue; end if;
        if v_wait >= 3 then continue; end if;
        if v_it->>'kind' = 'item' and (v_it->>'ref') = any(v_wait_refs) then continue; end if;
        v_wait := v_wait + 1;
        if v_it->>'kind' = 'item' then v_wait_refs := v_wait_refs || (v_it->>'ref'); end if;
        v_it := jsonb_build_object('id', v_id, 'kind', v_it->>'kind', 'ref', case when v_it->>'kind' = 'item' then v_it->>'ref' end,
          'amt', 500, 'code', left(coalesce(v_it->>'code', ''), 12), 'm', left(coalesce(v_it->>'m', ''), 8),
          'ts', floor(extract(epoch from now()) * 1000)::bigint, 'nick', left(coalesce(v_it->>'nick', ''), 24), 'qty', 1);
      end if;
    end if;
    v_seen := v_seen || v_id;
    v_out := v_out || jsonb_build_array(v_it);
  end loop;
  new.data := jsonb_build_object('items', v_out);
  return new;
end $$;
revoke all on function private.orders_guard() from public, anon, authenticated;
create trigger orders_guard before insert or update on public.orders for each row execute function private.orders_guard();

/* ---------- 2. login ID + password (no email). The password is kept only as a bcrypt hash. ---------- */
create table if not exists private.logins (
  name text primary key check (name ~ '^[a-z0-9_]{3,20}$'),
  owner uuid not null unique references auth.users(id) on delete cascade,
  pass text not null,
  created_at timestamptz not null default now(),
  changed_at timestamptz not null default now()
);
create table if not exists private.login_tries (k text primary key, n int not null default 0, window_start timestamptz not null default now());

create or replace function private.try_ok(p_key text, p_max int, p_window interval) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v private.login_tries%rowtype;
begin
  select * into v from private.login_tries t where t.k = p_key for update;
  if v.k is null then
    insert into private.login_tries (k, n, window_start) values (p_key, 1, now()) on conflict (k) do update set n = private.login_tries.n + 1;
    return true;
  end if;
  if v.window_start < now() - p_window then update private.login_tries t set n = 1, window_start = now() where t.k = p_key; return true; end if;
  if v.n >= p_max then return false; end if;
  update private.login_tries t set n = t.n + 1 where t.k = p_key;
  return true;
end $$;

-- an ID belongs to the account its owner uses now (an account can later be joined into another one)
create or replace function private.login_of(p_acct uuid) returns private.logins
language sql stable security definer set search_path = '' as $$
  select l from private.logins l where public.acct_of(l.owner) = p_acct order by l.created_at limit 1;
$$;

create or replace function public.id_me() returns text
language sql stable security definer set search_path = '' as $$ select (private.login_of(public.acct())).name; $$;

-- create an ID for the account in use: everything recorded so far stays with it
create or replace function public.id_register(p_name text, p_pass text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_name text := lower(btrim(coalesce(p_name, ''))); v_owner uuid := public.acct();
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then return jsonb_build_object('ok', false, 'err', 'bad_name'); end if;
  if v_name in ('admin', 'administrator', 'root', 'zzirit', 'jjirit', 'operator', 'support', 'system', 'null', 'undefined', 'test', 'manager', 'official', 'staff') then return jsonb_build_object('ok', false, 'err', 'taken'); end if;
  if length(coalesce(p_pass, '')) < 6 or length(p_pass) > 72 then return jsonb_build_object('ok', false, 'err', 'bad_pass'); end if;
  if (private.login_of(v_owner)).name is not null then return jsonb_build_object('ok', false, 'err', 'has_id'); end if;
  if not private.try_ok('reg:' || auth.uid()::text, 10, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  begin
    insert into private.logins (name, owner, pass) values (v_name, v_owner, extensions.crypt(p_pass, extensions.gen_salt('bf', 8)));
  exception when unique_violation then return jsonb_build_object('ok', false, 'err', 'taken');
  end;
  return jsonb_build_object('ok', true, 'name', v_name);
end $$;

-- join this device to an account with a one-time code, through the same redemption as the device code
create or replace function private.join_with_code(p_owner uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_code text := ''; v_bytes bytea; i int; v_res jsonb;
begin
  v_bytes := extensions.gen_random_bytes(12);
  for i in 0..11 loop v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1); end loop;
  insert into private.link_codes (code_hash, owner, expires_at)
  values (encode(extensions.digest(v_code, 'sha256'), 'hex'), p_owner, now() + interval '1 minute');
  v_res := public.link_redeem(v_code);
  if not coalesce((v_res->>'ok')::boolean, false) then
    -- not used: make the code worthless right away
    update private.link_codes c set expires_at = now() - interval '1 second' where c.code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex');
  end if;
  return v_res;
end $$;

-- right ID and password: this device joins that account, and what this device recorded comes along
create or replace function public.id_login(p_name text, p_pass text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_name text := lower(btrim(coalesce(p_name, ''))); v_row private.logins%rowtype; v_target uuid;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  if not private.try_ok('dev:' || auth.uid()::text, 10, interval '10 minutes') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  if not private.try_ok('name:' || v_name, 30, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  select * into v_row from private.logins l where l.name = v_name;
  if v_row.name is null or v_row.pass <> extensions.crypt(coalesce(p_pass, ''), v_row.pass) then
    perform pg_sleep(0.3);
    return jsonb_build_object('ok', false, 'err', 'wrong');
  end if;
  v_target := public.acct_of(v_row.owner);
  if v_target = public.acct() then return jsonb_build_object('ok', true, 'acct', v_target, 'name', v_row.name); end if;
  -- an account with its own ID stays separate: log out on this device first
  if (private.login_of(public.acct())).name is not null then return jsonb_build_object('ok', false, 'err', 'has_id'); end if;
  return private.join_with_code(v_target) || jsonb_build_object('name', v_row.name);
end $$;

create or replace function public.id_password(p_old text, p_new text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_row private.logins%rowtype;
begin
  v_row := private.login_of(public.acct());
  if v_row.name is null then return jsonb_build_object('ok', false, 'err', 'no_id'); end if;
  if not private.try_ok('pw:' || auth.uid()::text, 10, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  if v_row.pass <> extensions.crypt(coalesce(p_old, ''), v_row.pass) then return jsonb_build_object('ok', false, 'err', 'wrong'); end if;
  if length(coalesce(p_new, '')) < 6 or length(p_new) > 72 then return jsonb_build_object('ok', false, 'err', 'bad_pass'); end if;
  update private.logins l set pass = extensions.crypt(p_new, extensions.gen_salt('bf', 8)), changed_at = now() where l.name = v_row.name;
  return jsonb_build_object('ok', true);
end $$;

-- operator: a new password for someone who forgot theirs (they ask through KakaoTalk)
create or replace function public.admin_id_reset(p_name text, p_new text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if length(coalesce(p_new, '')) < 6 or length(p_new) > 72 then return jsonb_build_object('ok', false, 'err', 'bad_pass'); end if;
  update private.logins l set pass = extensions.crypt(p_new, extensions.gen_salt('bf', 8)), changed_at = now() where l.name = lower(btrim(coalesce(p_name, '')));
  if not found then return jsonb_build_object('ok', false, 'err', 'no_id'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- operator: which account has which ID (to help people who forgot theirs)
create or replace function public.admin_logins() returns table (acct uuid, name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return query select public.acct_of(l.owner), l.name, l.created_at from private.logins l order by l.created_at;
end $$;

-- operator: a one-time code (30 minutes) that brings someone back to an account they lost, e.g. after clearing
-- the browser. They type it in Settings → "Link PC and phone"; what the new device recorded joins the old account.
create or replace function public.admin_link_code(p_acct uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_owner uuid; v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_code text := ''; v_bytes bytea; i int;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_acct is null then raise exception 'no_account'; end if;
  v_owner := public.acct_of(p_acct);
  if not exists (select 1 from auth.users u where u.id = v_owner) then raise exception 'no_account'; end if;
  v_bytes := extensions.gen_random_bytes(8);
  for i in 0..7 loop v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1); end loop;
  insert into private.link_codes (code_hash, owner, expires_at)
  values (encode(extensions.digest(v_code, 'sha256'), 'hex'), v_owner, now() + interval '30 minutes');
  return v_code;
end $$;

revoke all on function private.try_ok(text, int, interval) from public, anon, authenticated;
revoke all on function private.login_of(uuid) from public, anon, authenticated;
revoke all on function private.join_with_code(uuid) from public, anon, authenticated;
revoke all on function public.id_me() from public, anon;
revoke all on function public.id_register(text, text) from public, anon;
revoke all on function public.id_login(text, text) from public, anon;
revoke all on function public.id_password(text, text) from public, anon;
revoke all on function public.admin_id_reset(text, text) from public, anon;
revoke all on function public.admin_logins() from public, anon;
revoke all on function public.admin_link_code(uuid) from public, anon;
grant execute on function public.id_me() to authenticated;
grant execute on function public.id_register(text, text) to authenticated;
grant execute on function public.id_login(text, text) to authenticated;
grant execute on function public.id_password(text, text) to authenticated;
grant execute on function public.admin_id_reset(text, text) to authenticated;
grant execute on function public.admin_logins() to authenticated;
grant execute on function public.admin_link_code(uuid) to authenticated;

/* rows written before a device was joined to an account still belong to that account */
create or replace function public.is_mine(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_id is not null and (p_id = public.acct() or exists (select 1 from private.links l where l.member = p_id and l.owner = public.acct()));
$$;
revoke all on function public.is_mine(uuid) from public, anon;
grant execute on function public.is_mine(uuid) to authenticated;

/* ---------- 3. automatic review: what the reviewer needs, and where its notes go ---------- */
create table if not exists private.species_names (id text primary key, en text, sci text, ko text);
insert into private.species_names (id, en, sci, ko) values
('kurodai', 'Black porgy', 'Acanthopagrus schlegelii', '감성돔'),
('madai', 'Red seabream', 'Pagrus major', '참돔'),
('ishidai', 'Barred knifejaw', 'Oplegnathus fasciatus', '돌돔'),
('ishigakidai', 'Spotted knifejaw', 'Oplegnathus punctatus', '강담돔'),
('mejina', 'Opaleye', 'Girella punctata', '벵에돔'),
('suzuki', 'Japanese sea bass', 'Lateolabrax japonicus', '농어'),
('hirame', 'Olive flounder', 'Paralichthys olivaceus', '넙치(광어)'),
('kurosoi', 'Korean rockfish', 'Sebastes schlegelii', '조피볼락(우럭)'),
('mebaru', 'Black rockfish', 'Sebastes inermis', '볼락'),
('usumebaru', 'Goldeye rockfish', 'Sebastes thompsoni', '불볼락(열기)'),
('ainame', 'Fat greenling', 'Hexagrammos otakii', '쥐노래미'),
('saba', 'Chub mackerel', 'Scomber japonicus', '고등어'),
('maaji', 'Japanese jack mackerel', 'Trachurus japonicus', '전갱이'),
('tachiuo', 'Largehead hairtail', 'Trichiurus lepturus', '갈치'),
('buri', 'Japanese amberjack', 'Seriola quinqueradiata', '방어'),
('hiramasa', 'Yellowtail amberjack', 'Seriola lalandi', '부시리'),
('kanpachi', 'Greater amberjack', 'Seriola dumerili', '잿방어'),
('sawara', 'Japanese Spanish mackerel', 'Scomberomorus niphonius', '삼치'),
('kuromaguro', 'Pacific bluefin tuna', 'Thunnus orientalis', '참다랑어'),
('iidako', 'Webfoot octopus', 'Amphioctopus fangsiao', '주꾸미'),
('madako', 'Common octopus', 'Octopus sinensis', '참문어'),
('mizudako', 'Giant Pacific octopus', 'Enteroctopus dofleini', '대문어'),
('surumeika', 'Japanese flying squid', 'Todarodes pacificus', '살오징어'),
('aoriika', 'Bigfin reef squid', 'Sepioteuthis lessoniana', '무늬오징어'),
('kensakiika', 'Swordtip squid', 'Uroteuthis edulis', '한치(창오징어)'),
('kouika', 'Golden cuttlefish', 'Sepia esculenta', '갑오징어'),
('sayori', 'Japanese halfbeak', 'Hyporhamphus sajori', '학공치'),
('kasago', 'Marbled rockfish', 'Sebastiscus marmoratus', '쏨뱅이'),
('onioko', 'Devil stinger', 'Inimicus japonicus', '쑤기미'),
('minokasago', 'Luna lionfish', 'Pterois lunulata', '쏠배감펭'),
('haokoze', 'Redfin velvetfish', 'Hypodytes rubripinnis', '미역치'),
('akaei', 'Whip stingray', 'Hemitrygon akajei', '노랑가오리'),
('aigo', 'Mottled spinefoot', 'Siganus fuscescens', '독가시치'),
('gonzui', 'Striped eel catfish', 'Plotosus japonicus', '쏠종개'),
('torafugu', 'Tiger puffer', 'Takifugu rubripes', '자주복(참복)'),
('kusafugu', 'Grass puffer', 'Takifugu alboplumbeus', '복섬'),
('mefugu', 'Obscure pufferfish', 'Takifugu obscurus', '황복'),
('unagi', 'Japanese eel', 'Anguilla japonica', '뱀장어'),
('kijihata', 'Hong Kong grouper', 'Epinephelus akaara', '붉바리'),
('mahata', 'Sevenband grouper', 'Hyporthodus septemfasciatus', '능성어'),
('kue', 'Longtooth grouper', 'Epinephelus bruneus', '자바리'),
('isaki', 'Chicken grunt', 'Parapristipoma trilineatum', '벤자리'),
('kawahagi', 'Thread-sail filefish', 'Stephanolepis cirrhifer', '쥐치'),
('shirogisu', 'Japanese whiting', 'Sillago japonica', '보리멸'),
('mahaze', 'Yellowfin goby', 'Acanthogobius flavimanus', '문절망둑(망둥어)'),
('bora', 'Flathead grey mullet', 'Mugil cephalus', '숭어'),
('miuy', 'Brown croaker', 'Miichthys miiuy', '민어'),
('kiguchi', 'Small yellow croaker', 'Larimichthys polyactis', '참조기'),
('madara', 'Pacific cod', 'Gadus macrocephalus', '대구'),
('hokke', 'Arabesque greenling', 'Pleurogrammus azonus', '임연수어'),
('makogarei', 'Marbled flounder', 'Pseudopleuronectes yokohamae', '문치가자미(도다리)'),
('magarei', 'Brown sole', 'Pseudopleuronectes herzensteini', '참가자미'),
('nishin', 'Pacific herring', 'Clupea pallasii', '청어'),
('konoshiro', 'Dotted gizzard shad', 'Konosirus punctatus', '전어'),
('magochi', 'Bartail flathead', 'Platycephalus indicus', '양태'),
('funa', 'Crucian carp', 'Carassius auratus', '붕어'),
('koi', 'Common carp', 'Cyprinus carpio', '잉어'),
('bass', 'Largemouth bass', 'Micropterus salmoides', '배스(큰입우럭)'),
('bluegill', 'Bluegill', 'Lepomis macrochirus', '블루길'),
('kerguigyo', 'Korean mandarin fish', 'Siniperca scherzeri', '쏘가리'),
('nijimasu', 'Rainbow trout', 'Oncorhynchus mykiss', '무지개송어'),
('yamame', 'Masu salmon (landlocked)', 'Oncorhynchus masou', '산천어'),
('namazu', 'Amur catfish', 'Silurus asotus', '메기'),
('gigi', 'Yellow catfish', 'Tachysurus fulvidraco', '동자개(빠가사리)'),
('hasu', 'Korean piscivorous chub', 'Opsariichthys uncirostris', '끄리'),
('kochoto', 'Redfin culter', 'Chanodichthys erythropterus', '강준치'),
('nigoi', 'Steed barbel', 'Hemibarbus labeo', '누치'),
('wakasagi', 'Japanese smelt', 'Hypomesus nipponensis', '빙어'),
('ayu', 'Sweetfish', 'Plecoglossus altivelis', '은어'),
('raigyo', 'Northern snakehead', 'Channa argus', '가물치'),
('kusauo', 'Grass carp', 'Ctenopharyngodon idella', '초어'),
('hakuren', 'Silver carp', 'Hypophthalmichthys molitrix', '백련어'),
('tilapia', 'Nile tilapia', 'Oreochromis niloticus', '틸라피아'),
('taimen', 'Siberian taimen', 'Hucho taimen', '타이멘'),
('yellowfin', 'Yellowfin tuna', 'Thunnus albacares', '황다랑어'),
('mahimahi', 'Mahi-mahi', 'Coryphaena hippurus', '만새기'),
('gt', 'Giant trevally', 'Caranx ignobilis', '무명갈전갱이(GT)'),
('sailfish', 'Indo-Pacific sailfish', 'Istiophorus platypterus', '돛새치'),
('bluemarlin', 'Blue marlin', 'Makaira nigricans', '녹새치'),
('redsnapper', 'Northern red snapper', 'Lutjanus campechanus', '레드스내퍼'),
('barramundi', 'Barramundi', 'Lates calcarifer', '바라문디'),
('tarpon', 'Atlantic tarpon', 'Megalops atlanticus', '타폰'),
('stripedbass', 'Striped bass', 'Morone saxatilis', '줄무늬농어'),
('reddrum', 'Red drum', 'Sciaenops ocellatus', '레드드럼'),
('kingsalmon', 'Chinook salmon', 'Oncorhynchus tshawytscha', '왕연어'),
('coho', 'Coho salmon', 'Oncorhynchus kisutch', '은연어'),
('halibut', 'Pacific halibut', 'Hippoglossus stenolepis', '태평양넙치'),
('atlcod', 'Atlantic cod', 'Gadus morhua', '대서양대구'),
('eubass', 'European seabass', 'Dicentrarchus labrax', '유럽농어'),
('snook', 'Common snook', 'Centropomus undecimalis', '스눅'),
('bonefish', 'Bonefish', 'Albula vulpes', '본피시'),
('barracuda', 'Great barracuda', 'Sphyraena barracuda', '큰꼬치고기(바라쿠다)'),
('wahoo', 'Wahoo', 'Acanthocybium solandri', '꼬치삼치'),
('stonefish', 'Reef stonefish', 'Synanceia verrucosa', '스톤피시'),
('lionfish', 'Red lionfish', 'Pterois volitans', '라이언피시'),
('pike', 'Northern pike', 'Esox lucius', '강꼬치고기(파이크)'),
('walleye', 'Walleye', 'Sander vitreus', '월아이'),
('smallmouth', 'Smallmouth bass', 'Micropterus dolomieu', '스몰마우스배스'),
('browntrout', 'Brown trout', 'Salmo trutta', '브라운송어'),
('atlsalmon', 'Atlantic salmon', 'Salmo salar', '대서양연어'),
('muskie', 'Muskellunge', 'Esox masquinongy', '머스키'),
('wels', 'Wels catfish', 'Silurus glanis', '유럽메기'),
('channelcat', 'Channel catfish', 'Ictalurus punctatus', '찬넬메기'),
('peacockbass', 'Peacock bass', 'Cichla ocellaris', '피콕배스'),
('arapaima', 'Arapaima', 'Arapaima gigas', '피라루쿠'),
('murraycod', 'Murray cod', 'Maccullochella peelii', '머리코드')
on conflict (id) do nothing;

-- the reviewer's note for each catch (why it was rejected or held); only the angler and the operator can read it
create table if not exists public.reviews (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
create policy "reviews read own" on public.reviews for select to authenticated using ((select public.is_admin()) or public.is_mine(id));
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;
alter publication supabase_realtime add table public.reviews;

-- the reviewer works at most once per p_seconds however often it is called
create or replace function public.review_claim(p_seconds int) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v timestamptz;
begin
  select m.v into v from private.news_meta m where m.k = 'review' for update;
  if v is not null and v > now() - make_interval(secs => greatest(20, p_seconds)) then return false; end if;
  insert into private.news_meta (k, v) values ('review', now()) on conflict (k) do update set v = excluded.v;
  return true;
end $$;

-- catches waiting for a check with no decision yet, oldest first, with what is needed to judge them
create or replace function public.review_queue(p_limit int)
returns table (uid uuid, cid text, sp text, len numeric, ts bigint, at bigint, past boolean, rel boolean, tr int, memo text,
               en text, sci text, ko text, l double precision, x double precision, photo text)
language sql stable security definer set search_path = '' as $$
  select a.id, c->>'id', c->>'sp',
    case when jsonb_typeof(c->'len') = 'number' then (c->>'len')::numeric end,
    case when jsonb_typeof(c->'ts') = 'number' then floor((c->>'ts')::numeric)::bigint end,
    case when jsonb_typeof(c->'at') = 'number' then floor((c->>'at')::numeric)::bigint end,
    coalesce(c->'past' = 'true'::jsonb, false), coalesce(c->'rel' = 'true'::jsonb, false),
    case when jsonb_typeof(c->'tr') = 'number' then round((c->>'tr')::numeric)::int end,
    left(coalesce(c->>'memo', ''), 300),
    n.en, n.sci, n.ko, s.l, s.x,
    (select p.data->>'t' from public.photos p where p.angler = a.id and p.cid = c->>'id')
  from public.anglers a
  cross join lateral jsonb_array_elements(case when jsonb_typeof(a.data->'catches') = 'array' then a.data->'catches' else '[]'::jsonb end) c
  left join private.species s on s.id = c->>'sp'
  left join private.species_names n on n.id = c->>'sp'
  where jsonb_typeof(c) = 'object' and c->>'st' = 'review'
    and (select g.data #>> array[a.id::text, c->>'id'] from public.admin_docs g where g.id = 'verdicts') is null
  order by case when jsonb_typeof(c->'at') = 'number' then (c->>'at')::numeric end nulls last
  limit greatest(1, least(p_limit, 20));
$$;

-- record a decision (the operator's own decision is never overwritten) and the reviewer's note
create or replace function public.review_set(p_uid uuid, p_cid text, p_v text, p_why text, p_model text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_done boolean; v_note jsonb;
begin
  if p_v not in ('ok', 'no', 'hold') or p_uid is null or coalesce(p_cid, '') = '' then return false; end if;
  insert into public.admin_docs (id, data) values ('verdicts', '{}'::jsonb) on conflict (id) do nothing;
  update public.admin_docs g set data = jsonb_set(g.data, array[p_uid::text], coalesce(g.data -> p_uid::text, '{}'::jsonb) || jsonb_build_object(p_cid, p_v))
    where g.id = 'verdicts' and (g.data #>> array[p_uid::text, p_cid]) is null
    returning true into v_done;
  if not coalesce(v_done, false) then return false; end if;
  v_note := jsonb_build_object('v', p_v, 'why', left(coalesce(p_why, ''), 200), 'm', left(coalesce(p_model, ''), 40), 'at', floor(extract(epoch from now()) * 1000)::bigint);
  insert into public.reviews (id, data, updated_at) values (p_uid, jsonb_build_object(p_cid, v_note), now())
  on conflict (id) do update set data = public.reviews.data || jsonb_build_object(p_cid, v_note), updated_at = now();
  return true;
end $$;
revoke all on function public.review_claim(int) from public, anon, authenticated;
grant execute on function public.review_claim(int) to service_role;
revoke all on function public.review_queue(int) from public, anon, authenticated;
revoke all on function public.review_set(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.review_queue(int) to service_role;
grant execute on function public.review_set(uuid, text, text, text, text) to service_role;

/* ---------- 4. fishing points (포인트): a spot, what bites there, tips. Private unless the owner shares it. ---------- */
create table if not exists public.points (
  id text primary key check (id ~ '^[a-z0-9]{6,24}$'),
  owner uuid not null default public.acct() references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 4000),
  pub boolean generated always as (coalesce(data->'pub' = 'true'::jsonb, false)) stored,
  updated_at timestamptz not null default now()
);
create index if not exists points_owner on public.points(owner);
-- room for one more point on this account (counted without the read rules, so the insert rule can use it)
create or replace function public.points_room() returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) < 300 from public.points p
  where p.owner = public.acct() or exists (select 1 from private.links l where l.member = p.owner and l.owner = public.acct());
$$;
revoke all on function public.points_room() from public, anon;
grant execute on function public.points_room() to authenticated;
alter table public.points enable row level security;
create policy "points read" on public.points for select to authenticated
  using (pub or public.is_mine(owner) or (select public.is_admin()));
create policy "points add" on public.points for insert to authenticated
  with check (owner = (select public.acct()) and (select public.points_room()));
create policy "points edit" on public.points for update to authenticated
  using (public.is_mine(owner) or (select public.is_admin())) with check (public.is_mine(owner) or (select public.is_admin()));
create policy "points remove" on public.points for delete to authenticated
  using (public.is_mine(owner) or (select public.is_admin()));
revoke all on public.points from anon, authenticated;
grant select, insert, update, delete on public.points to authenticated;
alter publication supabase_realtime add table public.points;
