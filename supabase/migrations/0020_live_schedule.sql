-- 0020: pay last week's 찌릿 라이브 prizes every Monday 00:05 Korean time (the app also settles when someone opens it).
select cron.schedule('zzirit-live-week', '5 15 * * 0', $$ select private.live_award(private.zp_week() - 7) $$);
