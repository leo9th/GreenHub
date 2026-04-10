-- Issue 1: Missing image_url column / PostgREST schema cache.
-- Run in Supabase → SQL Editor (idempotent).

alter table public.chat_messages add column if not exists image_url text;

notify pgrst, 'reload schema';
