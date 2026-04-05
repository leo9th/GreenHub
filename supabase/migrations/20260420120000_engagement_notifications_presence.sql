-- GreenHub: product likes, unique views, in-app notifications (new messages), profile contact prefs.

-- ---------------------------------------------------------------------------
-- Profiles: contact visibility + ensure last_active exists
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists show_phone_on_profile boolean not null default false;
alter table public.profiles add column if not exists show_email_on_profile boolean not null default false;
alter table public.profiles add column if not exists last_active timestamptz default now();

comment on column public.profiles.show_phone_on_profile is 'When true, phone is shown on public profile / contact.';
comment on column public.profiles.show_email_on_profile is 'When true, email is shown on public profile / contact.';

-- ---------------------------------------------------------------------------
-- Product likes
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists like_count integer not null default 0;

create table if not exists public.product_likes (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists product_likes_product_id_idx on public.product_likes (product_id);

alter table public.product_likes enable row level security;

drop policy if exists "product_likes_select_all" on public.product_likes;
create policy "product_likes_select_all"
  on public.product_likes for select to anon, authenticated using (true);

drop policy if exists "product_likes_insert_own" on public.product_likes;
create policy "product_likes_insert_own"
  on public.product_likes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "product_likes_delete_own" on public.product_likes;
create policy "product_likes_delete_own"
  on public.product_likes for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.bump_product_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.products set like_count = coalesce(like_count, 0) + 1 where id = new.product_id;
  elsif tg_op = 'DELETE' then
    update public.products set like_count = greatest(coalesce(like_count, 0) - 1, 0) where id = old.product_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_bump_product_like_count_ins on public.product_likes;
create trigger trg_bump_product_like_count_ins
  after insert on public.product_likes
  for each row execute function public.bump_product_like_count();

drop trigger if exists trg_bump_product_like_count_del on public.product_likes;
create trigger trg_bump_product_like_count_del
  after delete on public.product_likes
  for each row execute function public.bump_product_like_count();

-- ---------------------------------------------------------------------------
-- Unique product views (per logged-in user or anonymous session key)
-- ---------------------------------------------------------------------------
create table if not exists public.product_view_events (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  viewer_key text not null,
  first_seen_at timestamptz not null default now(),
  constraint product_view_events_unique_viewer unique (product_id, viewer_key)
);

create index if not exists product_view_events_product_id_idx on public.product_view_events (product_id);

-- Replace increment with deduped bump
create or replace function public.record_product_view(p_product_id bigint, p_anon_session text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  inserted int;
begin
  if auth.uid() is not null then
    v_key := auth.uid()::text;
  else
    if p_anon_session is null or length(trim(p_anon_session)) < 12 then
      return;
    end if;
    v_key := 'anon:' || trim(p_anon_session);
  end if;

  insert into public.product_view_events (product_id, viewer_key)
  values (p_product_id, v_key)
  on conflict (product_id, viewer_key) do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then
    update public.products
    set views = coalesce(views, 0) + 1
    where id = p_product_id;
  end if;
end;
$$;

grant execute on function public.record_product_view(bigint, text) to anon, authenticated;

-- Legacy RPC (always +1). Prefer record_product_view for unique-per-viewer counts.
create or replace function public.increment_product_views(p_product_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products set views = coalesce(views, 0) + 1 where id = p_product_id;
end;
$$;
grant execute on function public.increment_product_views(bigint) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'message',
  title text not null,
  body text not null default '',
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts from clients (optional); message inserts also come from trigger (definer)
drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
  on public.notifications for insert to authenticated
  with check (user_id = auth.uid());

create or replace function public.notify_recipient_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recip uuid;
  c record;
  body_text text;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if not found then
    return new;
  end if;

  if new.sender_id = c.buyer_id then
    recip := c.seller_id;
  elsif new.sender_id = c.seller_id then
    recip := c.buyer_id;
  else
    return new;
  end if;

  body_text := left(
    coalesce(
      nullif(trim(new.message), ''),
      nullif(trim(new.body), ''),
      'New message'
    ),
    200
  );

  insert into public.notifications (user_id, type, title, body, data)
  values (
    recip,
    'message',
    'New message',
    body_text,
    jsonb_build_object(
      'conversation_id', new.conversation_id::text,
      'message_id', new.id::text,
      'sender_id', new.sender_id::text
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_chat_message on public.chat_messages;
create trigger trg_notify_on_chat_message
  after insert on public.chat_messages
  for each row execute function public.notify_recipient_on_new_message();

-- ---------------------------------------------------------------------------
-- Unread message counts (for badges)
-- ---------------------------------------------------------------------------
create or replace function public.inbox_unread_by_conversation()
returns table (conversation_id uuid, unread_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select m.conversation_id, count(*)::bigint
  from public.chat_messages m
  inner join public.conversations c on c.id = m.conversation_id
  where (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    and m.sender_id <> auth.uid()
    and (
      (c.buyer_id = auth.uid() and (c.buyer_last_read_at is null or m.created_at > c.buyer_last_read_at))
      or
      (c.seller_id = auth.uid() and (c.seller_last_read_at is null or m.created_at > c.seller_last_read_at))
    )
  group by m.conversation_id;
$$;

grant execute on function public.inbox_unread_by_conversation() to authenticated;

create or replace function public.total_unread_message_count()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(count(*), 0)::bigint
  from public.chat_messages m
  inner join public.conversations c on c.id = m.conversation_id
  where (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    and m.sender_id <> auth.uid()
    and (
      (c.buyer_id = auth.uid() and (c.buyer_last_read_at is null or m.created_at > c.buyer_last_read_at))
      or
      (c.seller_id = auth.uid() and (c.seller_last_read_at is null or m.created_at > c.seller_last_read_at))
    );
$$;

grant execute on function public.total_unread_message_count() to authenticated;

create or replace function public.mark_message_notifications_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null
    and type = 'message'
    and coalesce(data->>'conversation_id', '') = p_conversation_id::text;
end;
$$;

grant execute on function public.mark_message_notifications_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Presence: heartbeat (updates profiles.last_active)
-- ---------------------------------------------------------------------------
create or replace function public.update_last_active()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set last_active = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.update_last_active() to authenticated;

-- ---------------------------------------------------------------------------
-- Public profile view: last_active + contact only when member opted in
-- ---------------------------------------------------------------------------
drop view if exists public.profiles_public;
create view public.profiles_public
with (security_invoker = false)
as
select
  p.id,
  p.full_name,
  p.avatar_url,
  p.gender,
  p.bio,
  p.state,
  p.lga,
  p.created_at,
  p.updated_at,
  p.last_active,
  case when coalesce(p.show_phone_on_profile, false) then p.phone else null end as phone,
  case when coalesce(p.show_email_on_profile, false) then p.email else null end as public_email
from public.profiles p;

comment on view public.profiles_public is
  'Directory-safe fields; phone/public_email only when user enabled visibility.';

revoke all on table public.profiles_public from public;
grant select on table public.profiles_public to anon, authenticated;
