-- 0022: the morning notice (아침 알림). Once a day, between 07:30 and 09:00 Korean time, a phone that said yes to
-- notices may get one short notice about the angler's own game: a fish in the keepnet that sells dear today (×1.2 or
-- more), the first day of the strong tides (사리), or last week's prize. Each of the three can be switched off. A notice
-- goes out only when there is something true to say; never more than one a morning.
-- Only adds: one table, one column (the fish names, for notices written on the server), functions, one schedule.

create table if not exists private.push_prefs (
  acct uuid primary key,
  market boolean not null default true,   -- a fish in my keepnet sells dear today
  tide boolean not null default true,     -- the strong tides start today
  rank boolean not null default true,     -- I won a prize last week
  updated_at timestamptz not null default now()
);
revoke all on private.push_prefs from public, anon, authenticated;

-- fish names [ko, en, ja, zh] (from src/fishdb.js)
alter table public.live_species add column if not exists n jsonb;
update public.live_species s set n = v.n from (values
  ('kurodai', '["감성돔","Black porgy","クロダイ","黑鲷"]'::jsonb), ('madai', '["참돔","Red seabream","マダイ","真鲷"]'::jsonb), ('ishidai', '["돌돔","Barred knifejaw","イシダイ","条石鲷"]'::jsonb),
  ('ishigakidai', '["강담돔","Spotted knifejaw","イシガキダイ","斑石鲷"]'::jsonb), ('mejina', '["벵에돔","Opaleye","メジナ","斑鱾"]'::jsonb), ('suzuki', '["농어","Japanese sea bass","スズキ","花鲈"]'::jsonb),
  ('hirame', '["넙치(광어)","Olive flounder","ヒラメ","牙鲆"]'::jsonb), ('kurosoi', '["조피볼락(우럭)","Korean rockfish","クロソイ","许氏平鲉"]'::jsonb), ('mebaru', '["볼락","Black rockfish","メバル","无备平鲉"]'::jsonb),
  ('usumebaru', '["불볼락(열기)","Goldeye rockfish","ウスメバル","汤氏平鲉"]'::jsonb), ('ainame', '["쥐노래미","Fat greenling","アイナメ","大泷六线鱼"]'::jsonb), ('saba', '["고등어","Chub mackerel","マサバ","日本鲭"]'::jsonb),
  ('maaji', '["전갱이","Japanese jack mackerel","マアジ","竹荚鱼"]'::jsonb), ('tachiuo', '["갈치","Largehead hairtail","タチウオ","带鱼"]'::jsonb), ('buri', '["방어","Japanese amberjack","ブリ","五条鰤"]'::jsonb),
  ('hiramasa', '["부시리","Yellowtail amberjack","ヒラマサ","黄条鰤"]'::jsonb), ('kanpachi', '["잿방어","Greater amberjack","カンパチ","高体鰤"]'::jsonb), ('sawara', '["삼치","Japanese Spanish mackerel","サワラ","蓝点马鲛"]'::jsonb),
  ('kuromaguro', '["참다랑어","Pacific bluefin tuna","クロマグロ","太平洋蓝鳍金枪鱼"]'::jsonb), ('iidako', '["주꾸미","Webfoot octopus","イイダコ","短蛸"]'::jsonb), ('madako', '["참문어","Common octopus","マダコ","真蛸"]'::jsonb),
  ('mizudako', '["대문어","Giant Pacific octopus","ミズダコ","北太平洋巨型章鱼"]'::jsonb), ('surumeika', '["살오징어","Japanese flying squid","スルメイカ","太平洋褶柔鱼"]'::jsonb), ('aoriika', '["무늬오징어","Bigfin reef squid","アオリイカ","莱氏拟乌贼"]'::jsonb),
  ('kensakiika', '["한치(창오징어)","Swordtip squid","ケンサキイカ","剑尖枪乌贼"]'::jsonb), ('kouika', '["갑오징어","Golden cuttlefish","コウイカ","金乌贼"]'::jsonb), ('sayori', '["학공치","Japanese halfbeak","サヨリ","日本下鱵"]'::jsonb),
  ('kasago', '["쏨뱅이","Marbled rockfish","カサゴ","褐菖鲉"]'::jsonb), ('onioko', '["쑤기미","Devil stinger","オニオコゼ","鬼鲉"]'::jsonb), ('minokasago', '["쏠배감펭","Luna lionfish","ミノカサゴ","翱翔蓑鲉"]'::jsonb),
  ('haokoze', '["미역치","Redfin velvetfish","ハオコゼ","红鳍拟鳞鲉"]'::jsonb), ('akaei', '["노랑가오리","Whip stingray","アカエイ","赤魟"]'::jsonb), ('aigo', '["독가시치","Mottled spinefoot","アイゴ","褐蓝子鱼"]'::jsonb),
  ('gonzui', '["쏠종개","Striped eel catfish","ゴンズイ","线纹鳗鲇"]'::jsonb), ('torafugu', '["자주복(참복)","Tiger puffer","トラフグ","红鳍东方鲀"]'::jsonb), ('kusafugu', '["복섬","Grass puffer","クサフグ","黑点多纪鲀"]'::jsonb),
  ('mefugu', '["황복","Obscure pufferfish","メフグ","暗纹东方鲀"]'::jsonb), ('unagi', '["뱀장어","Japanese eel","ニホンウナギ","日本鳗鲡"]'::jsonb), ('kijihata', '["붉바리","Hong Kong grouper","キジハタ","赤点石斑鱼"]'::jsonb),
  ('mahata', '["능성어","Sevenband grouper","マハタ","七带石斑鱼"]'::jsonb), ('kue', '["자바리","Longtooth grouper","クエ","褐点石斑鱼"]'::jsonb), ('isaki', '["벤자리","Chicken grunt","イサキ","三线矶鲈"]'::jsonb),
  ('kawahagi', '["쥐치","Thread-sail filefish","カワハギ","丝背细鳞鲀"]'::jsonb), ('shirogisu', '["보리멸","Japanese whiting","シロギス","少鳞鱚"]'::jsonb), ('mahaze', '["문절망둑(망둥어)","Yellowfin goby","マハゼ","黄鳍刺虾虎鱼"]'::jsonb),
  ('bora', '["숭어","Flathead grey mullet","ボラ","鲻鱼"]'::jsonb), ('miuy', '["민어","Brown croaker","ホンニベ","鮸"]'::jsonb), ('kiguchi', '["참조기","Small yellow croaker","キグチ","小黄鱼"]'::jsonb),
  ('madara', '["대구","Pacific cod","マダラ","大头鳕"]'::jsonb), ('hokke', '["임연수어","Arabesque greenling","ホッケ","远东多线鱼"]'::jsonb), ('makogarei', '["문치가자미(도다리)","Marbled flounder","マコガレイ","钝吻黄盖鲽"]'::jsonb),
  ('magarei', '["참가자미","Brown sole","マガレイ","赫氏拟鲽"]'::jsonb), ('nishin', '["청어","Pacific herring","ニシン","太平洋鲱"]'::jsonb), ('konoshiro', '["전어","Dotted gizzard shad","コノシロ","斑鰶"]'::jsonb),
  ('magochi', '["양태","Bartail flathead","マゴチ","鲬"]'::jsonb), ('funa', '["붕어","Crucian carp","フナ","鲫鱼"]'::jsonb), ('koi', '["잉어","Common carp","コイ","鲤鱼"]'::jsonb),
  ('bass', '["배스(큰입우럭)","Largemouth bass","オオクチバス","大口黑鲈"]'::jsonb), ('bluegill', '["블루길","Bluegill","ブルーギル","蓝鳃太阳鱼"]'::jsonb), ('kerguigyo', '["쏘가리","Korean mandarin fish","コウライケツギョ","斑鳜"]'::jsonb),
  ('nijimasu', '["무지개송어","Rainbow trout","ニジマス","虹鳟"]'::jsonb), ('yamame', '["산천어","Masu salmon (landlocked)","ヤマメ","山女鳟"]'::jsonb), ('namazu', '["메기","Amur catfish","ナマズ","鲇"]'::jsonb),
  ('gigi', '["동자개(빠가사리)","Yellow catfish","コウライギギ","黄颡鱼"]'::jsonb), ('hasu', '["끄리","Korean piscivorous chub","ハス","马口鱼"]'::jsonb), ('kochoto', '["강준치","Redfin culter","カワヒラ","红鳍原鲌"]'::jsonb),
  ('nigoi', '["누치","Steed barbel","ニゴイ","唇䱻"]'::jsonb), ('wakasagi', '["빙어","Japanese smelt","ワカサギ","公鱼"]'::jsonb), ('ayu', '["은어","Sweetfish","アユ","香鱼"]'::jsonb),
  ('raigyo', '["가물치","Northern snakehead","カムルチー","乌鳢"]'::jsonb), ('kusauo', '["초어","Grass carp","ソウギョ","草鱼"]'::jsonb), ('hakuren', '["백련어","Silver carp","ハクレン","鲢鱼"]'::jsonb),
  ('tilapia', '["틸라피아","Nile tilapia","ナイルティラピア","尼罗罗非鱼"]'::jsonb), ('taimen', '["타이멘","Siberian taimen","アムールイトウ","哲罗鲑"]'::jsonb), ('yellowfin', '["황다랑어","Yellowfin tuna","キハダ","黄鳍金枪鱼"]'::jsonb),
  ('mahimahi', '["만새기","Mahi-mahi","シイラ","鲯鳅"]'::jsonb), ('gt', '["무명갈전갱이(GT)","Giant trevally","ロウニンアジ","浪人鲹"]'::jsonb), ('sailfish', '["돛새치","Indo-Pacific sailfish","バショウカジキ","平鳍旗鱼"]'::jsonb),
  ('bluemarlin', '["녹새치","Blue marlin","クロカジキ","蓝枪鱼"]'::jsonb), ('redsnapper', '["레드스내퍼","Northern red snapper","レッドスナッパー","北方红笛鲷"]'::jsonb), ('barramundi', '["바라문디","Barramundi","バラマンディ","尖吻鲈"]'::jsonb),
  ('tarpon', '["타폰","Atlantic tarpon","ターポン","大西洋大海鲢"]'::jsonb), ('stripedbass', '["줄무늬농어","Striped bass","ストライプドバス","条纹狼鲈"]'::jsonb), ('reddrum', '["레드드럼","Red drum","レッドドラム","美国红鱼"]'::jsonb),
  ('kingsalmon', '["왕연어","Chinook salmon","マスノスケ","大鳞大麻哈鱼"]'::jsonb), ('coho', '["은연어","Coho salmon","ギンザケ","银大麻哈鱼"]'::jsonb), ('halibut', '["태평양넙치","Pacific halibut","オヒョウ","狭鳞庸鲽"]'::jsonb),
  ('atlcod', '["대서양대구","Atlantic cod","タイセイヨウダラ","大西洋鳕"]'::jsonb), ('eubass', '["유럽농어","European seabass","ヨーロッパスズキ","舌齿鲈"]'::jsonb), ('snook', '["스눅","Common snook","コモンスヌーク","锯盖鱼"]'::jsonb),
  ('bonefish', '["본피시","Bonefish","ソトイワシ","北梭鱼"]'::jsonb), ('barracuda', '["큰꼬치고기(바라쿠다)","Great barracuda","オニカマス","大魣"]'::jsonb), ('wahoo', '["꼬치삼치","Wahoo","カマスサワラ","刺鲅"]'::jsonb),
  ('stonefish', '["스톤피시","Reef stonefish","オニダルマオコゼ","玫瑰毒鲉"]'::jsonb), ('lionfish', '["라이언피시","Red lionfish","ハナミノカサゴ","魔鬼蓑鲉"]'::jsonb), ('pike', '["강꼬치고기(파이크)","Northern pike","ノーザンパイク","白斑狗鱼"]'::jsonb),
  ('walleye', '["월아이","Walleye","ウォールアイ","玻璃梭鲈"]'::jsonb), ('smallmouth', '["스몰마우스배스","Smallmouth bass","コクチバス","小口黑鲈"]'::jsonb), ('browntrout', '["브라운송어","Brown trout","ブラウントラウト","河鳟"]'::jsonb),
  ('atlsalmon', '["대서양연어","Atlantic salmon","タイセイヨウサケ","大西洋鲑"]'::jsonb), ('muskie', '["머스키","Muskellunge","マスキー","北美狗鱼"]'::jsonb), ('wels', '["유럽메기","Wels catfish","ヨーロッパオオナマズ","欧鲇"]'::jsonb),
  ('channelcat', '["찬넬메기","Channel catfish","アメリカナマズ","斑点叉尾鮰"]'::jsonb), ('peacockbass', '["피콕배스","Peacock bass","ピーコックバス","眼斑丽鱼"]'::jsonb), ('arapaima', '["피라루쿠","Arapaima","ピラルク","巨骨舌鱼"]'::jsonb),
  ('murraycod', '["머리코드","Murray cod","マーレーコッド","虫纹鳕鲈"]'::jsonb)
) as v(id, n) where s.id = v.id;

/* ---- my choices ---- */
create or replace function public.push_prefs() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('market', p.market, 'tide', p.tide, 'rank', p.rank) from private.push_prefs p where p.acct = public.acct()),
                  jsonb_build_object('market', true, 'tide', true, 'rank', true));
$$;
create or replace function public.push_prefs_set(p_market boolean, p_tide boolean, p_rank boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct();
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  insert into private.push_prefs as p (acct, market, tide, rank) values (v_acct, coalesce(p_market, true), coalesce(p_tide, true), coalesce(p_rank, true))
    on conflict (acct) do update set market = excluded.market, tide = excluded.tide, rank = excluded.rank, updated_at = now();
  return public.push_prefs();
end $$;

/* ---- the morning round (the push function, service role only) ----
   Every account with a phone that said yes, at most p_limit of them a call, that has not had its morning notice today
   and has something to hear: returns what to say, and writes it down first, so that two rounds never send it twice.
   p_at is for the tests; the push function never passes it. */
create or replace function public.push_morning(p_limit int default 300, p_at timestamptz default null)
returns table (acct uuid, items jsonb)
language plpgsql volatile security definer set search_path = '' as $$
declare v_at timestamptz := coalesce(p_at, now()); v_kst timestamp; v_day date; v_h numeric; v_noon timestamptz; v_spring boolean;
  v_max int := greatest(1, least(coalesce(p_limit, 300), 1000)); v_n int := 0;
  r record; f record; z record; v_items jsonb; v_mk boolean; v_td boolean; v_rk boolean; v_rank text;
begin
  v_kst := v_at at time zone 'Asia/Seoul'; v_day := v_kst::date;
  v_h := extract(hour from v_kst) + extract(minute from v_kst) / 60.0;
  if v_h < 7.5 or v_h >= 9 then return; end if;                -- mornings only
  v_noon := (v_day + time '12:00') at time zone 'Asia/Seoul';
  v_spring := private.live_tide(v_noon) >= 0.85 and private.live_tide(v_noon - interval '1 day') < 0.85;   -- the first strong day
  for r in select distinct public.acct_of(s.acct) as a from private.push_subs s where not s.off loop
    exit when v_n >= v_max;
    if exists (select 1 from private.push_log l where l.to_acct = r.a and l.kind = 'am' and l.ref = v_day::text) then continue; end if;
    select coalesce((select p.market from private.push_prefs p where p.acct = r.a), true),
           coalesce((select p.tide from private.push_prefs p where p.acct = r.a), true),
           coalesce((select p.rank from private.push_prefs p where p.acct = r.a), true) into v_mk, v_td, v_rk;
    v_items := '[]'::jsonb; v_rank := null;
    -- last week's prize, not told yet
    if v_rk then
      select x.ref, x.delta, x.note into z from public.zp_ledger x
       where x.acct = r.a and x.reason = 'prize' and x.ref like 'live:%' and x.created_at > v_at - interval '8 days'
         and not exists (select 1 from private.push_log l where l.to_acct = r.a and l.kind = 'rank' and l.ref = x.ref)
       order by x.id desc limit 1;
      if found then
        v_rank := z.ref;
        v_items := v_items || jsonb_build_object('k', 'rank', 'r', case when z.note ~ '^[0-9]+$' then z.note::int else null end, 'p', z.delta);
      end if;
    end if;
    -- the dearest fish in the keepnet that sells at ×1.2 or more today
    if v_mk then
      select x.sp, s.n, private.live_rate(x.sp, v_day) as rate, private.live_price(x.val, private.live_rate(x.sp, v_day)) as p into f
        from public.live_catches x join public.live_species s on s.id = x.sp
       where x.acct = r.a and x.val is not null and x.sold_at is null and private.live_rate(x.sp, v_day) >= 1.2
       order by 4 desc, x.id limit 1;
      if found then v_items := v_items || jsonb_build_object('k', 'mkt', 'sp', f.sp, 'n', f.n, 'x', f.rate, 'p', f.p); end if;
    end if;
    -- the strong tides begin (only for those who have played)
    if v_td and v_spring and exists (select 1 from private.live_days d where d.acct = r.a) then v_items := v_items || jsonb_build_object('k', 'tide'); end if;
    if jsonb_array_length(v_items) = 0 then continue; end if;
    insert into private.push_log (to_acct, kind, ref, from_uid) values (r.a, 'am', v_day::text, null) on conflict do nothing;
    if not found then continue; end if;                            -- another round took this one
    if v_rank is not null then insert into private.push_log (to_acct, kind, ref, from_uid) values (r.a, 'rank', v_rank, null) on conflict do nothing; end if;
    v_n := v_n + 1;
    acct := r.a; items := v_items; return next;
  end loop;
end $$;

revoke all on function public.push_prefs(), public.push_prefs_set(boolean, boolean, boolean) from public, anon;
grant execute on function public.push_prefs(), public.push_prefs_set(boolean, boolean, boolean) to authenticated;
revoke all on function public.push_morning(int, timestamptz) from public, anon, authenticated;
grant execute on function public.push_morning(int, timestamptz) to service_role;
