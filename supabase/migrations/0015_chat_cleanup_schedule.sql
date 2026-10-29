-- 0015: the open chat shows the last 3 days and is kept 30 days on the server; every night at 04:23 (Korean time)
-- older messages are removed. 1:1 messages stay until one of the two leaves (회원 탈퇴 removes them).
select cron.schedule('zzirit-chat-cleanup', '23 19 * * *', $$
  delete from public.chat where created_at < now() - interval '30 days';
$$);
