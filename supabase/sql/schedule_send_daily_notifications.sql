select cron.schedule(
  'send-daily-notifications',
  '0 9 * * *',
  $$
  select
    net.http_post(
      url := 'https://kuawbbgopeyqorwkotms.functions.supabase.co/send-scheduled-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-scheduled-secret', '111bf98ace9c4630b25b6b6a82515bc3'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
) as job_id;
