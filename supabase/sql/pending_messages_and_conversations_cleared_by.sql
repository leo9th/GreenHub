-- Mirrors migration: 20260623120000_pending_messages_and_conversations_cleared_by.sql

create table if not exists public.pending_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  message text,
  image_url text,
  created_at timestamptz not null default now(),
  retry_count integer not null default 0
);

create index if not exists idx_pending_messages_conversation
  on public.pending_messages (conversation_id);

create index if not exists idx_pending_messages_sender
  on public.pending_messages (sender_id);

alter table public.pending_messages enable row level security;

drop policy if exists "Users can manage their own pending messages" on public.pending_messages;

create policy "Users can manage their own pending messages"
  on public.pending_messages
  for all
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

alter table public.conversations
  add column if not exists cleared_by uuid[] not null default '{}';

notify pgrst, 'reload schema';
