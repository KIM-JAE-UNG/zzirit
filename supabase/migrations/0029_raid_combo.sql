-- 0029: 합동 챔질 counts on the server. When others in the same raid struck in the last 1.6 seconds, this strike does
-- 25% more for each of them (up to 4 others: +100%). The server looks at the strikes it already has, so a phone can't
-- claim a team strike that did not happen. The answer also says how many struck together ('combo') and the extra damage.
-- Only replaces public.live_raid_hit with the same arguments and rights (adds two fields to its answer). No data changes.

-- one strike (as in 0027), now with the 합동 챔질 bonus
create or replace function public.live_raid_hit(p_id bigint, p_q numeric) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_acct uuid := public.acct(); c private.raid_cfg%rowtype; r private.live_raids%rowtype; h private.live_raid_hits%rowtype;
  v_q numeric; v_crit boolean; v_dmg int; v_n int; v_bonus int := 0;
begin
  if auth.uid() is null or v_acct is null then raise exception 'not_signed_in'; end if;
  if not private.zp_profile_ok(v_acct) then return jsonb_build_object('err', 'no_profile'); end if;
  select * into c from private.raid_cfg where id = 1;
  perform private.raid_now();
  select * into r from private.live_raids x where x.id = p_id for update;
  if not found then return jsonb_build_object('err', 'no_raid'); end if;
  if r.beaten_at is not null then return jsonb_build_object('err', 'beaten', 'raid', private.raid_json(r, v_acct)); end if;
  if now() < r.starts or now() >= r.ends then return jsonb_build_object('err', 'over', 'raid', private.raid_json(r, v_acct)); end if;
  select * into h from private.live_raid_hits x where x.raid = r.id and x.acct = v_acct for update;
  if not found then
    -- someone new: the monster grows stronger (the first one fights it at its base strength)
    if exists (select 1 from private.live_raid_hits x where x.raid = r.id) then
      update private.live_raids x set hp = x.hp + c.add_hp, max_hp = x.max_hp + c.add_hp where x.id = r.id returning * into r;
    end if;
    insert into private.live_raid_hits (raid, acct) values (r.id, v_acct) returning * into h;
  elsif h.last_at > clock_timestamp() - make_interval(secs => c.gap_ms / 1000.0) then
    return jsonb_build_object('err', 'fast');
  end if;
  v_q := least(greatest(coalesce(p_q, 0), 0), 1);
  v_crit := v_q >= 0.85;
  v_dmg := 6 + round(v_q * 12)::int + floor(random() * 5)::int;
  if v_crit then v_dmg := v_dmg * 2; end if;
  -- 합동 챔질: the others in this raid who struck in the last 1.6 seconds (their strike is already in, so it can't be faked)
  select count(*) into v_n from private.live_raid_hits x
    where x.raid = r.id and x.acct <> v_acct and x.hits > 0 and x.last_at >= clock_timestamp() - interval '1.6 seconds';
  v_n := least(v_n, 4) + 1;
  if v_n > 1 then v_bonus := round(v_dmg * 0.25 * (v_n - 1))::int; end if;
  v_dmg := least(v_dmg + v_bonus, greatest(r.hp, 0));
  v_bonus := least(v_bonus, v_dmg);
  update private.live_raid_hits x set dmg = x.dmg + v_dmg, hits = x.hits + 1, crits = x.crits + v_crit::int, last_at = clock_timestamp()
    where x.raid = r.id and x.acct = v_acct returning * into h;
  update private.live_raids x set hp = x.hp - v_dmg where x.id = r.id returning * into r;
  if r.hp <= 0 then perform private.raid_win(r.id); select * into r from private.live_raids x where x.id = p_id; end if;
  return jsonb_build_object('ok', true, 'dmg', v_dmg, 'crit', v_crit, 'combo', v_n, 'bonus', v_bonus, 'hp', greatest(r.hp, 0), 'max', r.max_hp,
    'beaten', r.beaten_at is not null, 'raid', case when r.beaten_at is not null then private.raid_json(r, v_acct) else null end,
    'me', jsonb_build_object('d', h.dmg, 'hits', h.hits));
end $$;

revoke all on function public.live_raid_hit(bigint, numeric) from public, anon;
grant execute on function public.live_raid_hit(bigint, numeric) to authenticated;
