-- 0018: the 찌릿 낚시점 grows — rods, reels and floats next to the lures. Each section has two signature pieces that
-- carry the ZZIRIT mark and cost a few weeks of winning (800–1,200 points); the metal jig and the minnow become the
-- signature lures. Prices live here, the app only shows them. Only adds and re-prices; nothing is removed.
insert into public.zp_items (id, price, sort) values
  ('rod_iso', 150, 11), ('rod_wine', 250, 12), ('rod_spark', 900, 13), ('rod_bolt', 1200, 14),
  ('reel_red', 180, 21), ('reel_lbr', 250, 22), ('reel_spark', 900, 23), ('reel_bolt', 1200, 24),
  ('float_ball', 100, 31), ('float_led', 200, 32), ('float_spark', 800, 33), ('float_bolt', 1000, 34),
  ('jig', 800, 7), ('minnow', 1000, 8)
on conflict (id) do update set price = excluded.price, sort = excluded.sort;
