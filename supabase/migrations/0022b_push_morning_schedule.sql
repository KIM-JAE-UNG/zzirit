-- 0022: the morning round runs every 10 minutes from 07:00 to 08:50 Korean time (22:00–23:50 UTC); the database
-- sends nothing before 07:30 and each angler gets at most one notice a morning.
select cron.schedule('zzirit-push-morning', '*/10 22-23 * * *', $$
  select net.http_post(
    url := 'https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_boTFYfsXMus91z3d6JpNvA_ffnrQvXk'),
    body := '{"op":"morning"}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
