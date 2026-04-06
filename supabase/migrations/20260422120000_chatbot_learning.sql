-- GreenHub: multilingual chatbot learning (training pairs, feedback, conversation log).
-- Note: public.conversations is reserved for buyer/seller DMs. Bot turns live in chatbot_conversations.

-- ---------------------------------------------------------------------------
-- 1. training_data — intents, pattern phrases, responses; admin approval gate
-- ---------------------------------------------------------------------------
create table if not exists public.training_data (
  id uuid primary key default gen_random_uuid(),
  intent text not null,
  patterns text[] not null,
  responses text[] not null,
  language text not null default 'en',
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  constraint training_data_patterns_nonempty check (cardinality(patterns) >= 1),
  constraint training_data_responses_nonempty check (cardinality(responses) >= 1)
);

create index if not exists training_data_lang_approved_idx
  on public.training_data (language, approved)
  where approved = true;

create index if not exists training_data_created_at_idx
  on public.training_data (created_at desc);

comment on table public.training_data is 'Chatbot intents: pattern phrases and reply variants. Only approved=true is used in production replies.';

-- ---------------------------------------------------------------------------
-- 2. user_feedback — thumbs, wrong-response corrections, learning signals
-- ---------------------------------------------------------------------------
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  bot_response text not null,
  user_rating smallint
    constraint user_feedback_rating_values check (user_rating is null or user_rating in (-1, 1)),
  corrected_response text,
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_user_id_idx on public.user_feedback (user_id);
create index if not exists user_feedback_created_at_idx on public.user_feedback (created_at desc);

comment on table public.user_feedback is 'Per-turn feedback: user_rating -1 thumb down, 1 thumb up; corrected_response when user fixes the bot.';
comment on column public.user_feedback.user_rating is '1 = thumbs up, -1 = thumbs down, null = no vote.';

-- ---------------------------------------------------------------------------
-- 3. chatbot_conversations — each row = one user message + bot reply
--    (spec name "conversations"; table renamed to avoid clash with DM conversations)
-- ---------------------------------------------------------------------------
create table if not exists public.chatbot_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  response text not null,
  language text not null default 'en',
  intent text,
  created_at timestamptz not null default now()
);

create index if not exists chatbot_conversations_user_created_idx
  on public.chatbot_conversations (user_id, created_at desc);

create index if not exists chatbot_conversations_created_at_idx
  on public.chatbot_conversations (created_at desc);

comment on table public.chatbot_conversations is 'Assistant chat log: user message, bot reply, detected intent, language.';

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.training_data enable row level security;
alter table public.user_feedback enable row level security;
alter table public.chatbot_conversations enable row level security;

-- training_data: only approved rows are visible to clients (plus own unapproved rows if you add source_user_id later)
drop policy if exists "training_data_select_approved" on public.training_data;
create policy "training_data_select_approved"
  on public.training_data for select
  to anon, authenticated
  using (approved = true);

-- Users/learn flow may only insert pending (unapproved) rows; admins approve in Dashboard or via service role
drop policy if exists "training_data_insert_pending" on public.training_data;
create policy "training_data_insert_pending"
  on public.training_data for insert
  to authenticated
  with check (approved = false);

-- Admin: full access when JWT app_metadata.role = 'admin' (set per user in Supabase Auth)
drop policy if exists "training_data_admin_all" on public.training_data;
create policy "training_data_admin_all"
  on public.training_data for all
  to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

-- user_feedback: insert own rows; read own rows (for history/debug)
drop policy if exists "user_feedback_insert_authenticated" on public.user_feedback;
create policy "user_feedback_insert_authenticated"
  on public.user_feedback for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_feedback_insert_anon" on public.user_feedback;
create policy "user_feedback_insert_anon"
  on public.user_feedback for insert
  to anon
  with check (user_id is null);

drop policy if exists "user_feedback_select_own" on public.user_feedback;
create policy "user_feedback_select_own"
  on public.user_feedback for select
  to authenticated
  using (user_id is not null and user_id = auth.uid());

drop policy if exists "user_feedback_admin_all" on public.user_feedback;
create policy "user_feedback_admin_all"
  on public.user_feedback for all
  to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

-- chatbot_conversations: insert when authenticated as self or anon with null user_id
drop policy if exists "chatbot_conversations_insert_auth" on public.chatbot_conversations;
create policy "chatbot_conversations_insert_auth"
  on public.chatbot_conversations for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "chatbot_conversations_insert_anon" on public.chatbot_conversations;
create policy "chatbot_conversations_insert_anon"
  on public.chatbot_conversations for insert
  to anon
  with check (user_id is null);

drop policy if exists "chatbot_conversations_select_own" on public.chatbot_conversations;
create policy "chatbot_conversations_select_own"
  on public.chatbot_conversations for select
  to authenticated
  using (user_id is not null and user_id = auth.uid());

drop policy if exists "chatbot_conversations_admin_all" on public.chatbot_conversations;
create policy "chatbot_conversations_admin_all"
  on public.chatbot_conversations for all
  to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin')
  with check (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');
