-- Chat file attachments (images + PDF/Word): public bucket + RLS for Storage.
-- Run in Supabase SQL Editor (or via migration) before using "Attach" in Chat.
--
-- Bucket only (minimal) — use ON CONFLICT (id): plain "ON CONFLICT DO NOTHING" has no target in Postgres.
--   insert into storage.buckets (id, name, public)
--   values ('chat-attachments', 'chat-attachments', true)
--   on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Chat attachments are publicly readable" on storage.objects;
create policy "Chat attachments are publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-attachments');

drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload chat attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-attachments');
