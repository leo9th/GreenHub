-- Legacy DBs may have `notifications` without `data`; trigger + app expect jsonb payload.
alter table public.notifications
  add column if not exists data jsonb not null default '{}';

comment on column public.notifications.data is
  'Payload for routing (e.g. message: conversation_id, message_id, sender_id).';
