-- Refresh the fishing news every 6 hours (the news function itself refreshes at most once an hour).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('zzirit-news', '17 */6 * * *', $$
  select net.http_post(
    url := 'https://tnvzckfssjocgtmlxkii.supabase.co/functions/v1/news',
    headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', 'sb_publishable_boTFYfsXMus91z3d6JpNvA_ffnrQvXk'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$);
