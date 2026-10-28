-- Run the automatic reviewer every 5 minutes (it also wakes up right after a catch is sent for review).
select cron.schedule('zzirit-review', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/review',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_boTFYfsXMus91z3d6JpNvA_ffnrQvXk'),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
$$);
