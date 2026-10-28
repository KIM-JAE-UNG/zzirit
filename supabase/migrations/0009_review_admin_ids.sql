-- 0009: automatic review of catches (AI), operator can delete accounts, optional login ID (no email) for any device.

-- species names so the reviewer can tell the AI what was claimed
alter table private.species add column if not exists en text;
alter table private.species add column if not exists sci text;
alter table private.species add column if not exists ko text;
update private.species s set en = v.en, sci = v.sci, ko = v.ko from (values
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
) v(id, en, sci, ko) where s.id = v.id;

-- the reviewer's notes (why a catch was rejected or held) live next to the operator's decisions
alter table public.admin_docs drop constraint if exists admin_docs_id_check;
alter table public.admin_docs add constraint admin_docs_id_check check (id in ('config', 'grants', 'verdicts', 'mod', 'autorev'));
insert into public.admin_docs (id, data) values ('verdicts', '{}'::jsonb), ('autorev', '{}'::jsonb) on conflict (id) do nothing;

/* ---------- automatic review (called by the `review` server function only) ---------- */
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
    s.en, s.sci, s.ko, s.l, s.x,
    (select p.data->>'t' from public.photos p where p.angler = a.id and p.cid = c->>'id')
  from public.anglers a
  cross join lateral jsonb_array_elements(case when jsonb_typeof(a.data->'catches') = 'array' then a.data->'catches' else '[]'::jsonb end) c
  left join private.species s on s.id = c->>'sp'
  where jsonb_typeof(c) = 'object' and c->>'st' = 'review'
    and (select g.data #>> array[a.id::text, c->>'id'] from public.admin_docs g where g.id = 'verdicts') is null
  order by case when jsonb_typeof(c->'at') = 'number' then (c->>'at')::numeric end nulls last
  limit greatest(1, least(p_limit, 20));
$$;

-- record a decision; the operator's own decision is never overwritten
create or replace function public.review_set(p_uid uuid, p_cid text, p_v text, p_why text, p_model text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_done boolean;
begin
  if p_v not in ('ok', 'no', 'hold') or p_uid is null or coalesce(p_cid, '') = '' then return false; end if;
  insert into public.admin_docs (id, data) values ('verdicts', '{}'::jsonb), ('autorev', '{}'::jsonb) on conflict (id) do nothing;
  update public.admin_docs g set data = jsonb_set(g.data, array[p_uid::text], coalesce(g.data -> p_uid::text, '{}'::jsonb) || jsonb_build_object(p_cid, p_v))
    where g.id = 'verdicts' and (g.data #>> array[p_uid::text, p_cid]) is null
    returning true into v_done;
  if not coalesce(v_done, false) then return false; end if;
  update public.admin_docs g set data = jsonb_set(g.data, array[p_uid::text], coalesce(g.data -> p_uid::text, '{}'::jsonb) || jsonb_build_object(p_cid,
      jsonb_build_object('v', p_v, 'why', left(coalesce(p_why, ''), 200), 'm', left(coalesce(p_model, ''), 40), 'at', floor(extract(epoch from now()) * 1000)::bigint)))
    where g.id = 'autorev';
  return true;
end $$;
revoke all on function public.review_claim(int) from public, anon, authenticated;
revoke all on function public.review_queue(int) from public, anon, authenticated;
revoke all on function public.review_set(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.review_claim(int) to service_role;
grant execute on function public.review_queue(int) to service_role;
grant execute on function public.review_set(uuid, text, text, text, text) to service_role;

/* ---------- operator: delete an account with everything it posted ---------- */
create or replace function public.admin_delete_user(p_uid uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_ids uuid[]; v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_uid is null then return false; end if;
  p_uid := public.acct_of(p_uid);
  if p_uid = public.acct() or exists (select 1 from public.app_admins a where a.uid = p_uid) then raise exception 'cannot_delete_admin'; end if;
  -- the account and every device linked to it
  select array_agg(x) into v_ids from (select p_uid as x union select l.member from private.links l where l.owner = p_uid) q;
  foreach v_id in array v_ids loop
    -- references kept by other people: friend edges, team rosters, operator notes
    update public.anglers a set data = jsonb_set(a.data, '{fr}', (a.data->'fr') - v_id::text) where jsonb_typeof(a.data->'fr') = 'object' and a.data->'fr' ? v_id::text;
    update public.teams tm set data = jsonb_set(tm.data, '{members}', (tm.data->'members') - v_id::text) where jsonb_typeof(tm.data->'members') = 'object' and tm.data->'members' ? v_id::text;
    update public.anglers a set data = a.data - 'team' where a.data #>> '{team,id}' = v_id::text;
    update public.admin_docs g set data = g.data - v_id::text where g.data ? v_id::text;
  end loop;
  -- removing the sign-in removes the rest (profile, catches, photos, posts, team, orders, login ID, links)
  delete from auth.users u where u.id = any(v_ids);
  return true;
end $$;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;

/* ---------- joining an account (link code or login ID) ---------- */
create or replace function private.join_account(v_owner uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_me uuid; v_mine jsonb; v_doc jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  if v_owner = auth.uid() or v_owner = public.acct() then return jsonb_build_object('ok', true, 'acct', v_owner); end if;
  -- a device that leads a team must disband it first (members point at its id)
  if exists (select 1 from public.teams tm where tm.id = public.acct()) then return jsonb_build_object('ok', false, 'err', 'team_leader'); end if;
  -- an account with its own login ID stays separate (log out on this device first)
  if exists (select 1 from private.logins l where l.owner = public.acct()) then return jsonb_build_object('ok', false, 'err', 'has_id'); end if;

  -- bring this device's own records into the account
  v_me := public.acct();
  update public.ai_tickets t set uid = v_owner where t.uid = v_me;
  insert into public.spots (uid, cid, lat, lon) select v_owner, s.cid, s.lat, s.lon from public.spots s where s.uid = v_me on conflict (uid, cid) do nothing;
  delete from public.spots s where s.uid = v_me;
  insert into public.photos (angler, cid, data) select v_owner, p.cid, p.data from public.photos p where p.angler = v_me and p.cid <> '_pic' on conflict (angler, cid) do nothing;
  delete from public.photos p where p.angler = v_me;
  select a.data into v_mine from public.anglers a where a.id = v_me;
  if v_mine is not null then
    select a.data into v_doc from public.anglers a where a.id = v_owner;
    if v_doc is null then
      insert into public.anglers (id, data) values (v_owner, v_mine);
    elsif jsonb_typeof(v_mine->'catches') = 'array' then
      update public.anglers a set data = jsonb_set(a.data, '{catches}', coalesce(a.data->'catches', '[]'::jsonb) || coalesce((
        select jsonb_agg(x) from jsonb_array_elements(v_mine->'catches') x
        where not exists (select 1 from jsonb_array_elements(coalesce(a.data->'catches', '[]'::jsonb)) y where y->>'id' = x->>'id')), '[]'::jsonb))
      where a.id = v_owner;
    end if;
    delete from public.anglers a where a.id = v_me;
  end if;
  for v_doc in select l.data from public.labels l where l.id = v_me loop
    insert into public.labels (id, data) values (v_owner, v_doc)
    on conflict (id) do update set data = jsonb_build_object('items', coalesce(public.labels.data->'items', '[]'::jsonb) || coalesce(excluded.data->'items', '[]'::jsonb));
  end loop;
  delete from public.labels l where l.id = v_me;
  for v_doc in select o.data from public.orders o where o.id = v_me loop
    insert into public.orders (id, data) values (v_owner, v_doc)
    on conflict (id) do update set data = jsonb_build_object('items', coalesce(public.orders.data->'items', '[]'::jsonb) || coalesce(excluded.data->'items', '[]'::jsonb));
  end loop;
  delete from public.orders o where o.id = v_me;
  for v_doc in select s.data from public.suggest s where s.id = v_me loop
    insert into public.suggest (id, data) values (v_owner, v_doc)
    on conflict (id) do update set data = jsonb_build_object('items', coalesce(public.suggest.data->'items', '[]'::jsonb) || coalesce(excluded.data->'items', '[]'::jsonb));
  end loop;
  delete from public.suggest s where s.id = v_me;
  for v_doc in select private.swap_id(b.data, v_me, v_owner) from public.board b where b.id = v_me loop
    insert into public.board (id, data) values (v_owner, v_doc)
    on conflict (id) do update set data = jsonb_build_object('v', 1,
      'posts', coalesce(public.board.data->'posts', '[]'::jsonb) || coalesce(excluded.data->'posts', '[]'::jsonb),
      'cmts', coalesce(public.board.data->'cmts', '[]'::jsonb) || coalesce(excluded.data->'cmts', '[]'::jsonb),
      'likes', coalesce(public.board.data->'likes', '[]'::jsonb) || coalesce(excluded.data->'likes', '[]'::jsonb),
      'reps', coalesce(public.board.data->'reps', '[]'::jsonb) || coalesce(excluded.data->'reps', '[]'::jsonb));
  end loop;
  delete from public.board b where b.id = v_me;
  -- references held by others: friend edges, comments/likes on my posts, team rosters, operator decisions
  update public.anglers a set data = private.swap_id(a.data, v_me, v_owner) where a.data::text like '%' || v_me::text || '%';
  update public.board b set data = private.swap_id(b.data, v_me, v_owner) where b.data::text like '%' || v_me::text || '%';
  update public.teams tm set data = private.swap_id(tm.data, v_me, v_owner) where tm.data::text like '%' || v_me::text || '%';
  update public.admin_docs g set data = private.swap_id(g.data, v_me, v_owner) where g.data::text like '%' || v_me::text || '%';
  -- devices that were linked to me (and the account's own first device) follow me
  update private.links l set owner = v_owner where l.owner = v_me;
  if v_me <> auth.uid() then
    insert into private.links (member, owner) values (v_me, v_owner) on conflict (member) do update set owner = excluded.owner, created_at = now();
  end if;
  insert into private.links (member, owner) values (auth.uid(), v_owner)
  on conflict (member) do update set owner = excluded.owner, created_at = now();
  return jsonb_build_object('ok', true, 'acct', v_owner);
end $$;

create or replace function public.link_redeem(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_row private.link_codes%rowtype;
  v_try private.link_tries%rowtype;
  v_res jsonb;
begin
  if v_me is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  select * into v_try from private.link_tries t where t.uid = v_me for update;
  if v_try.uid is null then insert into private.link_tries (uid, n, window_start) values (v_me, 1, now());
  elsif v_try.window_start < now() - interval '10 minutes' then update private.link_tries t set n = 1, window_start = now() where t.uid = v_me;
  elsif v_try.n >= 8 then return jsonb_build_object('ok', false, 'err', 'slow_down');
  else update private.link_tries t set n = t.n + 1 where t.uid = v_me; end if;

  select * into v_row from private.link_codes c
  where c.code_hash = encode(extensions.digest(upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex') and c.expires_at > now();
  if v_row.code_hash is null then return jsonb_build_object('ok', false, 'err', 'bad_code'); end if;
  v_res := private.join_account(v_row.owner);
  if (v_res->>'ok')::boolean then delete from private.link_codes c where c.code_hash = v_row.code_hash; end if;
  return v_res;
end $$;

/* ---------- login ID + password (no email). The password is stored only as a bcrypt hash. ---------- */
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

create or replace function public.id_me() returns text
language sql stable security definer set search_path = '' as $$
  select l.name from private.logins l where l.owner = public.acct();
$$;

create or replace function public.id_register(p_name text, p_pass text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_name text := lower(btrim(coalesce(p_name, ''))); v_owner uuid := public.acct();
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  if v_name !~ '^[a-z0-9_]{3,20}$' then return jsonb_build_object('ok', false, 'err', 'bad_name'); end if;
  if v_name in ('admin', 'administrator', 'root', 'zzirit', 'jjirit', 'operator', 'support', 'system', 'null', 'undefined', 'test') then return jsonb_build_object('ok', false, 'err', 'taken'); end if;
  if length(coalesce(p_pass, '')) < 6 or length(p_pass) > 72 then return jsonb_build_object('ok', false, 'err', 'bad_pass'); end if;
  if exists (select 1 from private.logins l where l.owner = v_owner) then return jsonb_build_object('ok', false, 'err', 'has_id'); end if;
  if not private.try_ok('reg:' || auth.uid()::text, 10, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  begin
    insert into private.logins (name, owner, pass) values (v_name, v_owner, extensions.crypt(p_pass, extensions.gen_salt('bf', 8)));
  exception when unique_violation then return jsonb_build_object('ok', false, 'err', 'taken');
  end;
  return jsonb_build_object('ok', true, 'name', v_name);
end $$;

-- right ID and password: this device joins that account (its own records come along)
create or replace function public.id_login(p_name text, p_pass text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_name text := lower(btrim(coalesce(p_name, ''))); v_row private.logins%rowtype; v_res jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'err', 'not_signed_in'); end if;
  if not private.try_ok('dev:' || auth.uid()::text, 10, interval '10 minutes') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  if not private.try_ok('name:' || v_name, 30, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  select * into v_row from private.logins l where l.name = v_name;
  if v_row.name is null or v_row.pass <> extensions.crypt(coalesce(p_pass, ''), v_row.pass) then
    perform pg_sleep(0.3);
    return jsonb_build_object('ok', false, 'err', 'wrong');
  end if;
  v_res := private.join_account(v_row.owner);
  return v_res || jsonb_build_object('name', v_row.name);
end $$;

create or replace function public.id_password(p_old text, p_new text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_row private.logins%rowtype;
begin
  select * into v_row from private.logins l where l.owner = public.acct();
  if v_row.name is null then return jsonb_build_object('ok', false, 'err', 'no_id'); end if;
  if not private.try_ok('pw:' || auth.uid()::text, 10, interval '1 hour') then return jsonb_build_object('ok', false, 'err', 'slow_down'); end if;
  if v_row.pass <> extensions.crypt(coalesce(p_old, ''), v_row.pass) then return jsonb_build_object('ok', false, 'err', 'wrong'); end if;
  if length(coalesce(p_new, '')) < 6 or length(p_new) > 72 then return jsonb_build_object('ok', false, 'err', 'bad_pass'); end if;
  update private.logins l set pass = extensions.crypt(p_new, extensions.gen_salt('bf', 8)), changed_at = now() where l.name = v_row.name;
  return jsonb_build_object('ok', true);
end $$;

-- operator: set a new password for someone who forgot theirs (they ask through KakaoTalk)
create or replace function public.admin_id_reset(p_name text, p_new text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if length(coalesce(p_new, '')) < 6 or length(p_new) > 72 then return jsonb_build_object('ok', false, 'err', 'bad_pass'); end if;
  update private.logins l set pass = extensions.crypt(p_new, extensions.gen_salt('bf', 8)), changed_at = now() where l.name = lower(btrim(coalesce(p_name, '')));
  if not found then return jsonb_build_object('ok', false, 'err', 'no_id'); end if;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function private.join_account(uuid) from public, anon, authenticated;
revoke all on function private.try_ok(text, int, interval) from public, anon, authenticated;
revoke all on function public.id_me() from public, anon;
revoke all on function public.id_register(text, text) from public, anon;
revoke all on function public.id_login(text, text) from public, anon;
revoke all on function public.id_password(text, text) from public, anon;
revoke all on function public.admin_id_reset(text, text) from public, anon;
grant execute on function public.id_me() to authenticated;
grant execute on function public.id_register(text, text) to authenticated;
grant execute on function public.id_login(text, text) to authenticated;
grant execute on function public.id_password(text, text) to authenticated;
grant execute on function public.admin_id_reset(text, text) to authenticated;
