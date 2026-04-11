-- ============================================================================
-- GreenHub: diagnostics for chat_messages 400 / "Message not sent"
-- Run in Supabase SQL Editor. Read each result grid.
-- ============================================================================

-- 1) Required columns (expect one row per column name listed below)
select
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'chat_messages'
  and c.column_name in (
    'id',
    'conversation_id',
    'sender_id',
    'message',
    'created_at',
    'reply_to_id',
    'image_url',
    'media_url',
    'edited',
    'status',
    'delivered_at',
    'read_at',
    'product_id'
  )
order by c.column_name;

-- 2) Missing required columns (should return 0 rows if schema is complete)
with required(name) as (
  values
    ('id'),
    ('conversation_id'),
    ('sender_id'),
    ('message'),
    ('created_at'),
    ('reply_to_id'),
    ('image_url'),
    ('media_url'),
    ('edited'),
    ('status'),
    ('delivered_at'),
    ('read_at'),
    ('product_id')
)
select r.name as missing_column
from required r
where not exists (
  select 1
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'chat_messages'
    and c.column_name = r.name
);

-- 3) Foreign keys involving reply_to_id (PostgREST embed uses this name)
select
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as definition
from pg_constraint c
join pg_class t on t.oid = c.conrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public'
  and t.relname = 'chat_messages'
  and c.contype = 'f'
  and (
    pg_get_constraintdef(c.oid) ilike '%reply_to_id%'
    or c.conname ilike '%reply_to%'
  );

-- 4) RLS enabled + policies
select
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'chat_messages';

select
  policyname as policy_name,
  cmd as command,
  qual as using_clause,
  with_check as with_check_clause
from pg_policies
where schemaname = 'public'
  and tablename = 'chat_messages'
order by policyname;

-- 5) Table grants (authenticated role)
select
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'chat_messages'
  and grantee in ('authenticated', 'anon', 'public')
order by grantee, privilege_type;

-- 6) Trigger on insert (if notify/touch fails, you may see 500 — still worth listing)
select tgname, pg_get_triggerdef(oid) as def
from pg_trigger
where tgrelid = 'public.chat_messages'::regclass
  and not tgisinternal
order by tgname;
