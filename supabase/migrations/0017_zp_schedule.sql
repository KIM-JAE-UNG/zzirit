-- 0017: every Monday at 00:05 Korean time (Sunday 15:05 UTC) last week's mini-game prizes go out. The app also settles a
-- finished week the first time anyone opens the games page, so this is only the punctual way. Only adds.
select cron.schedule('zzirit-zp-week', '5 15 * * 0', $$ select private.zp_award('rx', private.zp_week() - 7) $$);
