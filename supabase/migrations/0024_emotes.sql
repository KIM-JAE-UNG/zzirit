-- 0024: 감정 표현 (emotes) in the 찌릿 낚시점. The angler in 찌릿 라이브 can wave (free, nothing to buy), bow, dance or do
-- the 찌릿 dance; the last three are bought with points like the gear. The price lives here, zp_buy() checks it and
-- zp_owned remembers who has what. They do nothing in the game (no perk). Only adds rows; nothing is removed.
insert into public.zp_items (id, price, sort) values
  ('emo_bow', 150, 41), ('emo_dance', 300, 42), ('emo_zzirit', 800, 43)
on conflict (id) do nothing;
