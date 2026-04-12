-- GreenHub: ALL migrations concatenated in filename order (run via Supabase CLI supabase db push or split manually).
-- Generated bundle — prefer individual files in supabase/migrations/ for normal workflows.


-- ========== 20260404120000_seller_dashboard_and_verification.sql ==========

-- GreenHub: seller dashboard metrics support + ID verification
-- Run in Supabase SQL Editor or via `supabase db push` if using CLI.

-- 1) Product view counts (seller dashboard "Total views" + product detail)
alter table public.products
  add column if not exists views integer not null default 0;

comment on column public.products.views is 'Incremented when listing detail is opened; used for seller dashboard.';

-- Atomic increment (avoids read-modify-write races; callable by anon/authenticated clients)
create or replace function public.increment_product_views(p_product_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.products
  set views = coalesce(views, 0) + 1
  where id = p_product_id;
end;
$$;

grant execute on function public.increment_product_views(bigint) to anon, authenticated;

-- Allow sellers to read parent orders when they have a line item (dashboard metrics + recent activity).
-- RLS on orders is often buyer-only; add this so seller queries do not return empty.
drop policy if exists "orders_select_for_seller_line_items" on public.orders;
create policy "orders_select_for_seller_line_items"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1 from public.order_items oi
      where oi.order_id = orders.id
        and oi.seller_id = auth.uid()
    )
  );

-- Sellers read their own line items (dashboard + fulfillment).
drop policy if exists "order_items_select_seller_own" on public.order_items;
create policy "order_items_select_seller_own"
  on public.order_items for select
  to authenticated
  using (seller_id = auth.uid());

-- Buyers can read line items on orders they placed (keeps checkout/order pages working alongside seller policy).
drop policy if exists "order_items_select_buyer_order" on public.order_items;
create policy "order_items_select_buyer_order"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.buyer_id = auth.uid()
    )
  );

-- If your products.id is UUID instead of bigint, use this variant and comment out the bigint version:
-- create or replace function public.increment_product_views(p_product_id uuid) ...

-- 2) Seller ID verification metadata (files live in Storage)
create table if not exists public.seller_verification (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  id_type text not null check (id_type in ('nin', 'drivers_license', 'passport')),
  storage_path text not null,
  file_name text,
  mime_type text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, id_type)
);

create index if not exists seller_verification_seller_id_idx on public.seller_verification (seller_id);

alter table public.seller_verification enable row level security;

drop policy if exists "seller_verification_select_own" on public.seller_verification;
create policy "seller_verification_select_own"
  on public.seller_verification for select
  using (seller_id = auth.uid());

drop policy if exists "seller_verification_insert_own" on public.seller_verification;
create policy "seller_verification_insert_own"
  on public.seller_verification for insert
  with check (seller_id = auth.uid());

drop policy if exists "seller_verification_update_own" on public.seller_verification;
create policy "seller_verification_update_own"
  on public.seller_verification for update
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

-- 3) Private bucket for verification documents
insert into storage.buckets (id, name, public)
values ('seller-verification', 'seller-verification', false)
on conflict (id) do update set public = excluded.public;

-- Storage RLS: sellers read/write only under their user-id prefix (folder = uuid)
drop policy if exists "seller_verification_storage_insert" on storage.objects;
create policy "seller_verification_storage_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "seller_verification_storage_select" on storage.objects;
create policy "seller_verification_storage_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "seller_verification_storage_update" on storage.objects;
create policy "seller_verification_storage_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "seller_verification_storage_delete" on storage.objects;
create policy "seller_verification_storage_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'seller-verification'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- If storage.foldername is unavailable, replace the predicate with:
-- split_part(name, '/', 1) = auth.uid()::text


-- ========== 20260404140000_profile_bio_seller_reviews.sql ==========

-- GreenHub: optional bio on profiles + buyer reviews about sellers (classifieds profile)

alter table public.profiles
  add column if not exists bio text;

comment on column public.profiles.bio is 'Optional public-facing about text for profile / listings trust.';

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  product_id bigint null,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint seller_reviews_no_self check (seller_id <> reviewer_id)
);

create index if not exists seller_reviews_seller_id_idx on public.seller_reviews (seller_id);
create index if not exists seller_reviews_created_at_idx on public.seller_reviews (created_at desc);

alter table public.seller_reviews enable row level security;

drop policy if exists "seller_reviews_select_parties" on public.seller_reviews;
create policy "seller_reviews_select_parties"
  on public.seller_reviews for select
  to authenticated
  using (seller_id = auth.uid() or reviewer_id = auth.uid());

-- Optional: allow anyone logged in to read reviews for a seller (public profile later). Uncomment if needed:
-- drop policy if exists "seller_reviews_select_public" on public.seller_reviews;
-- create policy "seller_reviews_select_public"
--   on public.seller_reviews for select
--   to authenticated
--   using (true);

drop policy if exists "seller_reviews_insert_by_reviewer" on public.seller_reviews;
create policy "seller_reviews_insert_by_reviewer"
  on public.seller_reviews for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and seller_id <> auth.uid()
  );


-- ========== 20260405120000_product_boost_system.sql ==========

-- GreenHub: per-listing paid boosts (Paystack) + listing sort + admin/seller visibility

-- ---------------------------------------------------------------------------
-- Review aggregates (rpc_products_listing sort=rating); idempotent with product_reviews migration
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists average_rating numeric(4, 2) null,
  add column if not exists total_reviews integer not null default 0;

-- ---------------------------------------------------------------------------
-- Products: boost fields
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists boost_expires_at timestamptz,
  add column if not exists boost_tier text,
  add column if not exists boost_count integer not null default 0,
  add column if not exists priority_score integer not null default 0;

comment on column public.products.boost_expires_at is 'When the paid boost ends; null if never boosted or fully expired.';
comment on column public.products.boost_tier is 'daily | weekly | monthly | yearly â€” last purchased tier while active.';
comment on column public.products.boost_count is 'Number of successful boost purchases for this listing.';
comment on column public.products.priority_score is 'Listing sort weight among boosted items (default 100 when boost is active).';

alter table public.products
  drop constraint if exists products_boost_tier_check;

alter table public.products
  add constraint products_boost_tier_check
  check (boost_tier is null or boost_tier in ('daily', 'weekly', 'monthly', 'yearly'));

create index if not exists products_boost_expires_at_idx
  on public.products (boost_expires_at desc nulls last)
  where boost_expires_at is not null;

-- ---------------------------------------------------------------------------
-- Boost transactions
-- ---------------------------------------------------------------------------
create table if not exists public.boost_transactions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  amount numeric(10, 2) not null default 0,
  duration_days integer not null,
  boost_tier text not null,
  payment_reference text unique,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint boost_transactions_tier_check check (boost_tier in ('daily', 'weekly', 'monthly', 'yearly')),
  constraint boost_transactions_status_check check (
    status in ('pending', 'success', 'failed', 'refunded', 'admin_adjustment')
  )
);

create index if not exists boost_transactions_seller_id_idx on public.boost_transactions (seller_id);
create index if not exists boost_transactions_product_id_idx on public.boost_transactions (product_id);
create index if not exists boost_transactions_created_at_idx on public.boost_transactions (created_at desc);

alter table public.boost_transactions enable row level security;

drop policy if exists "boost_transactions_select_own" on public.boost_transactions;
create policy "boost_transactions_select_own"
  on public.boost_transactions for select
  to authenticated
  using (seller_id = auth.uid());

drop policy if exists "boost_transactions_select_admin" on public.boost_transactions;
create policy "boost_transactions_select_admin"
  on public.boost_transactions for select
  to authenticated
  using (coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin');

-- Inserts/updates only via service role or SECURITY DEFINER RPCs (no user insert policy)

-- ---------------------------------------------------------------------------
-- Helpers: admin check
-- ---------------------------------------------------------------------------
create or replace function public.is_admin_jwt()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'admin';
$$;

grant execute on function public.is_admin_jwt() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: sorted listing (boosted first, then priority_score, then user sort)
-- ---------------------------------------------------------------------------
create or replace function public.rpc_products_listing(
  p_search text default null,
  p_category text default null,
  p_condition text default null,
  p_car_brand text default null,
  p_state text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_sort text default 'recent',
  p_limit int default 12,
  p_offset int default 0
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_rows json;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_cat text := nullif(trim(coalesce(p_category, '')), '');
  v_cond text := nullif(trim(coalesce(p_condition, '')), '');
  v_brand text := nullif(trim(coalesce(p_car_brand, '')), '');
  v_state text := nullif(trim(coalesce(p_state, '')), '');
  v_sort text := coalesce(nullif(trim(coalesce(p_sort, '')), ''), 'recent');
begin
  if v_cat in ('all', '') then v_cat := null; end if;
  if v_cond in ('all', '') then v_cond := null; end if;
  if v_brand in ('all', '') then v_brand := null; end if;
  if v_state in ('all', '') then v_state := null; end if;

  with filtered as (
    select p.*
    from public.products p
    where p.status = 'active'
      and (
        v_search is null
        or p.title ilike '%' || v_search || '%'
      )
      and (v_cat is null or p.category = v_cat)
      and (v_cond is null or p.condition = v_cond)
      and (
        v_brand is null
        or coalesce(v_cat, '') <> 'vehicles'
        or p.car_brand = v_brand
      )
      and (
        v_state is null
        or p.location ilike '%' || v_state || '%'
      )
      and (p_price_min is null or coalesce(p.price_local, p.price, 0) >= p_price_min)
      and (p_price_max is null or coalesce(p.price_local, p.price, 0) <= p_price_max)
  ),
  counted as (
    select count(*)::bigint as cnt from filtered
  ),
  ordered as (
    select f.*
    from filtered f
    order by
      case
        when f.boost_expires_at is not null and f.boost_expires_at > now() then 0
        else 1
      end,
      coalesce(f.priority_score, 0) desc,
      case when v_sort = 'price-low' then coalesce(f.price_local, f.price, 0) end asc nulls last,
      case when v_sort = 'price-high' then coalesce(f.price_local, f.price, 0) end desc nulls last,
      case
        when v_sort = 'rating'
        then coalesce(f.average_rating, f.rating::numeric, 0)
      end desc nulls last,
      f.created_at desc nulls last
    limit greatest(coalesce(p_limit, 12), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    (select c.cnt from counted c),
    coalesce((select json_agg(to_jsonb(o)) from ordered o), '[]'::json)
  into v_total, v_rows;

  return json_build_object('total', coalesce(v_total, 0), 'rows', v_rows);
end;
$$;

grant execute on function public.rpc_products_listing(
  text, text, text, text, text, numeric, numeric, text, int, int
) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin: grant / clear boost (manual)
-- ---------------------------------------------------------------------------
create or replace function public.admin_grant_product_boost(
  p_product_id bigint,
  p_tier text,
  p_duration_days int,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
  v_until timestamptz;
begin
  if not public.is_admin_jwt() then
    raise exception 'not authorized';
  end if;
  if p_tier not in ('daily', 'weekly', 'monthly', 'yearly') then
    raise exception 'invalid tier';
  end if;
  if p_duration_days is null or p_duration_days < 1 then
    raise exception 'invalid duration';
  end if;

  select seller_id into v_seller from public.products where id = p_product_id;
  if v_seller is null then
    raise exception 'product not found';
  end if;

  select
    case
      when boost_expires_at is not null and boost_expires_at > now()
      then boost_expires_at + (p_duration_days::text || ' days')::interval
      else now() + (p_duration_days::text || ' days')::interval
    end
  into v_until
  from public.products
  where id = p_product_id;

  update public.products
  set
    boost_expires_at = v_until,
    boost_tier = p_tier,
    boost_count = coalesce(boost_count, 0) + 1,
    priority_score = 100,
    updated_at = now()
  where id = p_product_id;

  insert into public.boost_transactions (
    seller_id,
    product_id,
    amount,
    duration_days,
    boost_tier,
    payment_reference,
    status,
    notes
  ) values (
    v_seller,
    p_product_id,
    0,
    p_duration_days,
    p_tier,
    'admin-' || gen_random_uuid()::text,
    'admin_adjustment',
    coalesce(nullif(trim(p_notes), ''), 'Granted by admin')
  );

  return json_build_object('ok', true, 'boost_expires_at', v_until);
end;
$$;

grant execute on function public.admin_grant_product_boost(bigint, text, int, text) to authenticated;

create or replace function public.admin_clear_product_boost(p_product_id bigint, p_notes text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seller uuid;
  v_tier text;
begin
  if not public.is_admin_jwt() then
    raise exception 'not authorized';
  end if;

  select seller_id, boost_tier into v_seller, v_tier
  from public.products
  where id = p_product_id;

  if v_seller is null then
    raise exception 'product not found';
  end if;

  update public.products
  set
    boost_expires_at = null,
    boost_tier = null,
    priority_score = 0,
    updated_at = now()
  where id = p_product_id;

  insert into public.boost_transactions (
    seller_id,
    product_id,
    amount,
    duration_days,
    boost_tier,
    payment_reference,
    status,
    notes
  ) values (
    v_seller,
    p_product_id,
    0,
    1,
    coalesce(v_tier, 'daily'),
    'admin-clear-' || gen_random_uuid()::text,
    'admin_adjustment',
    coalesce(nullif(trim(p_notes), ''), 'Boost cleared by admin')
  );

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.admin_clear_product_boost(bigint, text) to authenticated;

create or replace function public.admin_refund_boost_transaction(
  p_transaction_id uuid,
  p_notes text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid bigint;
begin
  if not public.is_admin_jwt() then
    raise exception 'not authorized';
  end if;

  select product_id into v_pid from public.boost_transactions where id = p_transaction_id;
  if v_pid is null then
    raise exception 'transaction not found';
  end if;

  update public.boost_transactions
  set
    status = 'refunded',
    notes = coalesce(nullif(trim(p_notes), ''), notes, 'Refunded'),
    updated_at = now()
  where id = p_transaction_id;

  update public.products
  set
    boost_expires_at = null,
    boost_tier = null,
    priority_score = 0,
    updated_at = now()
  where id = v_pid;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.admin_refund_boost_transaction(uuid, text) to authenticated;


-- ========== 20260407120000_products_car_brand.sql ==========

-- Vehicle listings: popular car brand for Nigeria marketplace
alter table public.products add column if not exists car_brand text;

comment on column public.products.car_brand is 'When category is vehicles, seller-selected brand (preset name or custom text for "Other").';


-- ========== 20260407140000_chat_messages_reply_and_delete.sql ==========

-- Reply threading + delete own messages + conversation preview after deletes.

alter table public.chat_messages
  add column if not exists reply_to_id uuid references public.chat_messages (id) on delete set null;

create index if not exists chat_messages_reply_to_id_idx
  on public.chat_messages (reply_to_id)
  where reply_to_id is not null;

-- ---------------------------------------------------------------------------
-- After a message is deleted, refresh conversations.last_message / last_message_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_conversation_on_chat_message_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lm text;
  lmt timestamptz;
begin
  select left(m.message, 200), m.created_at into lm, lmt
  from public.chat_messages m
  where m.conversation_id = old.conversation_id
  order by m.created_at desc
  limit 1;

  update public.conversations
  set
    last_message = lm,
    last_message_at = lmt
  where id = old.conversation_id;

  return old;
end;
$$;

drop trigger if exists trg_touch_conversation_on_chat_message_delete on public.chat_messages;
create trigger trg_touch_conversation_on_chat_message_delete
  after delete on public.chat_messages
  for each row execute function public.touch_conversation_on_chat_message_delete();

drop policy if exists "chat_messages_delete_own" on public.chat_messages;

create policy "chat_messages_delete_own"
  on public.chat_messages for delete
  to authenticated
  using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

grant delete on table public.chat_messages to authenticated;


-- ========== 20260408120000_worker_profiles.sql ==========

-- Public hire directory (not GreenHub HR): visitors search for artisans/workers; contact is direct between hirer and profile owner.

create table if not exists public.worker_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  phone text not null,
  email text not null,
  city_state text not null,
  headline text not null,
  trade_category text not null,
  skills_summary text not null,
  years_experience numeric(6, 1),
  availability text not null,
  education_level text,
  languages text,
  expected_pay text,
  portfolio_url text,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists worker_profiles_list_idx on public.worker_profiles (status, trade_category, created_at desc);

comment on table public.worker_profiles is 'Labour/staff availability listings; employers browse active rows and contact by phone/email.';

alter table public.worker_profiles enable row level security;

drop policy if exists worker_profiles_public_read on public.worker_profiles;
create policy worker_profiles_public_read on public.worker_profiles for select
  using (status = 'active');

drop policy if exists worker_profiles_owner_read on public.worker_profiles;
create policy worker_profiles_owner_read on public.worker_profiles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists worker_profiles_insert on public.worker_profiles;
create policy worker_profiles_insert on public.worker_profiles for insert to anon, authenticated
  with check (true);

drop policy if exists worker_profiles_update_own on public.worker_profiles;
create policy worker_profiles_update_own on public.worker_profiles for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists worker_profiles_delete_own on public.worker_profiles;
create policy worker_profiles_delete_own on public.worker_profiles for delete to authenticated
  using (user_id = auth.uid());


-- ========== 20260409120000_job_application_uploads_bucket.sql ==========

-- Storage for GreenHub employment form (/apply): ID document + CV uploads.
-- Without this bucket, submit returns "Bucket not found".

insert into storage.buckets (id, name, public)
values ('job-application-uploads', 'job-application-uploads', false)
on conflict (id) do nothing;

-- Applicants may submit without signing in (anon); signed-in users also allowed.
drop policy if exists job_application_uploads_insert_public on storage.objects;
create policy job_application_uploads_insert_public on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'job-application-uploads');


-- ========== 20260409190000_fix_profiles_text_column_types.sql ==========

-- Repair older/misconfigured profiles schemas where text-like fields were created
-- with the wrong type (for example, avatar_url as smallint).

do $$
begin
  -- Ensure commonly used profile columns exist with the expected shape.
  alter table public.profiles add column if not exists full_name text;
  alter table public.profiles add column if not exists avatar_url text;
  alter table public.profiles add column if not exists phone text;
  alter table public.profiles add column if not exists gender text;
  alter table public.profiles add column if not exists state text;
  alter table public.profiles add column if not exists lga text;
  alter table public.profiles add column if not exists address text;
  alter table public.profiles add column if not exists email text;
  alter table public.profiles add column if not exists auto_reply text;
  alter table public.profiles add column if not exists bio text;
  alter table public.profiles add column if not exists updated_at timestamptz;

  -- Coerce text-like columns to text when an older schema used the wrong type.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column full_name type text using full_name::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_url'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column avatar_url type text using avatar_url::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'phone'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column phone type text using phone::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'gender'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column gender type text using gender::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'state'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column state type text using state::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'lga'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column lga type text using lga::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'address'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column address type text using address::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column email type text using email::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'auto_reply'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column auto_reply type text using auto_reply::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'bio'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column bio type text using bio::text;
  end if;
end
$$;
-- Repair older/misconfigured profiles schemas where text-like fields were created
-- with the wrong type (for example, avatar_url as smallint).

do $$
begin
  -- Ensure commonly used profile columns exist with the expected shape.
  alter table public.profiles add column if not exists full_name text;
  alter table public.profiles add column if not exists avatar_url text;
  alter table public.profiles add column if not exists phone text;
  alter table public.profiles add column if not exists gender text;
  alter table public.profiles add column if not exists state text;
  alter table public.profiles add column if not exists lga text;
  alter table public.profiles add column if not exists address text;
  alter table public.profiles add column if not exists email text;
  alter table public.profiles add column if not exists auto_reply text;
  alter table public.profiles add column if not exists bio text;
  alter table public.profiles add column if not exists updated_at timestamptz;

  -- Coerce text-like columns to text when an older schema used the wrong type.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column full_name type text using full_name::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_url'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column avatar_url type text using avatar_url::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'phone'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column phone type text using phone::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'gender'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column gender type text using gender::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'state'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column state type text using state::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'lga'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column lga type text using lga::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'address'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column address type text using address::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column email type text using email::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'auto_reply'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column auto_reply type text using auto_reply::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'bio'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column bio type text using bio::text;
  end if;
end
$$;


-- ========== 20260411120000_job_applications_review_and_id_uploads.sql ==========

-- Job applications: three ID uploads (front, back, selfie) + admin review fields.
-- Run after job_applications table exists (created in your project). Safe to re-run.

alter table public.job_applications add column if not exists id_document_front_storage_path text;
alter table public.job_applications add column if not exists id_document_back_storage_path text;
alter table public.job_applications add column if not exists id_selfie_storage_path text;

alter table public.job_applications add column if not exists review_status text default 'pending';
alter table public.job_applications add column if not exists admin_review_notes text;
alter table public.job_applications add column if not exists reviewed_at timestamptz;
alter table public.job_applications add column if not exists reviewed_by uuid references auth.users (id);

update public.job_applications set review_status = 'pending' where review_status is null;

-- Legacy single-document + typed fields are optional when using front/back/selfie
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_applications' and column_name = 'id_type'
  ) then
    alter table public.job_applications alter column id_type drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_applications' and column_name = 'id_number'
  ) then
    alter table public.job_applications alter column id_number drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'job_applications' and column_name = 'id_document_storage_path'
  ) then
    alter table public.job_applications alter column id_document_storage_path drop not null;
  end if;
end $$;

alter table public.job_applications enable row level security;

drop policy if exists "job_applications_insert_public" on public.job_applications;
create policy "job_applications_insert_public"
  on public.job_applications for insert
  to anon, authenticated
  with check (true);

-- Authenticated users can list/update (admin UI). Tighten to e.g. profiles.role = 'admin' in production.
drop policy if exists "job_applications_select_authenticated" on public.job_applications;
create policy "job_applications_select_authenticated"
  on public.job_applications for select
  to authenticated
  using (true);

drop policy if exists "job_applications_update_authenticated" on public.job_applications;
create policy "job_applications_update_authenticated"
  on public.job_applications for update
  to authenticated
  using (true)
  with check (true);

-- Allow signed URLs / downloads for reviewers (logged in).
drop policy if exists job_application_uploads_select_authenticated on storage.objects;
create policy job_application_uploads_select_authenticated on storage.objects
  for select
  to authenticated
  using (bucket_id = 'job-application-uploads');


-- ========== 20260411140000_conversations_and_chat_messages.sql ==========

-- Direct messaging: conversations (buyer_id / seller_id) + chat_messages.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references auth.users (id) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint conversations_distinct_roles check (buyer_id <> seller_id)
);

create unique index if not exists conversations_pair_idx
  on public.conversations (least(buyer_id, seller_id), greatest(buyer_id, seller_id));

create index if not exists conversations_buyer_id_idx on public.conversations (buyer_id);
create index if not exists conversations_seller_id_idx on public.conversations (seller_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at desc);

create or replace function public.touch_conversation_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message = left(new.message, 200),
    last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation_on_chat_message on public.chat_messages;
create trigger trg_touch_conversation_on_chat_message
  after insert on public.chat_messages
  for each row
  execute function public.touch_conversation_on_chat_message();

alter table public.conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "conversations_select_participant" on public.conversations;
drop policy if exists "conversations_insert_participant" on public.conversations;
drop policy if exists "conversations_update_participant" on public.conversations;
drop policy if exists "conversations_select_buyer_or_seller" on public.conversations;
drop policy if exists "conversations_insert_buyer_or_seller" on public.conversations;
drop policy if exists "conversations_update_buyer_or_seller" on public.conversations;

create policy "conversations_select_buyer_or_seller"
  on public.conversations for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "conversations_insert_buyer_or_seller"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "conversations_update_buyer_or_seller"
  on public.conversations for update
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id)
  with check (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists "chat_messages_select_participant" on public.chat_messages;
drop policy if exists "chat_messages_insert_sender" on public.chat_messages;
drop policy if exists "chat_messages_select_buyer_seller" on public.chat_messages;
drop policy if exists "chat_messages_insert_sender_buyer_seller" on public.chat_messages;

create policy "chat_messages_select_buyer_seller"
  on public.chat_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

create policy "chat_messages_insert_sender_buyer_seller"
  on public.chat_messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

grant select, insert, update, delete on table public.conversations to authenticated;
grant select, insert on table public.chat_messages to authenticated;


-- ========== 20260415100000_conversations_last_message_column.sql ==========

-- Align with app: column `last_message` (not `last_message_preview`) + trigger update.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'last_message_preview'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'last_message'
  ) then
    alter table public.conversations rename column last_message_preview to last_message;
  end if;
end $$;

create or replace function public.touch_conversation_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message = left(new.message, 200),
    last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;


-- ========== 20260416100000_conversations_context_product_read_receipts.sql ==========

-- Product context on DM threads + read receipts (peer last-opened time).

alter table public.conversations
  add column if not exists context_product_id bigint references public.products (id) on delete set null;

alter table public.conversations
  add column if not exists buyer_last_read_at timestamptz;

alter table public.conversations
  add column if not exists seller_last_read_at timestamptz;

create index if not exists conversations_context_product_id_idx on public.conversations (context_product_id);


-- ========== 20260418120000_chat_messages_message_column.sql ==========

-- chat_messages content column is `message` (not `body`). Idempotent.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'body'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'chat_messages'
      and column_name = 'message'
  ) then
    alter table public.chat_messages rename column body to message;
  end if;
end $$;

create or replace function public.touch_conversation_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message = left(new.message, 200),
    last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;


-- ========== 20260419100000_seller_reviews_verification_public_read.sql ==========

-- Allow marketplace pages (product detail, profiles) to read seller reviews and approved verification status.
-- Existing policy keeps insert rules; this adds read access for trust display.

drop policy if exists "seller_reviews_select_marketplace" on public.seller_reviews;
create policy "seller_reviews_select_marketplace"
  on public.seller_reviews for select
  to anon, authenticated
  using (true);

drop policy if exists "seller_verification_select_approved_public" on public.seller_verification;
create policy "seller_verification_select_approved_public"
  on public.seller_verification for select
  to anon, authenticated
  using (status = 'approved');


-- ========== 20260420120000_engagement_notifications_presence.sql ==========

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


-- ========== 20260421120000_product_reviews.sql ==========

-- GreenHub: product reviews (per listing) + denormalized aggregates on products
-- Run in Supabase SQL Editor or via supabase db push.

-- ---------------------------------------------------------------------------
-- Columns on products (denormalized; maintained by trigger)
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists average_rating numeric(4, 2) null,
  add column if not exists total_reviews integer not null default 0;

comment on column public.products.average_rating is 'Average star rating (1â€“5) from product_reviews; null when no reviews.';
comment on column public.products.total_reviews is 'Count of rows in product_reviews for this listing.';

-- ---------------------------------------------------------------------------
-- Reviews table (one row per user per product)
-- ---------------------------------------------------------------------------
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.products (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint product_reviews_one_per_user unique (product_id, user_id)
);

create index if not exists product_reviews_product_id_idx on public.product_reviews (product_id);
create index if not exists product_reviews_user_id_idx on public.product_reviews (user_id);
create index if not exists product_reviews_created_at_idx on public.product_reviews (created_at desc);

comment on table public.product_reviews is 'Buyer reviews of a specific product listing (distinct from seller_reviews).';

-- ---------------------------------------------------------------------------
-- Keep products.average_rating and products.total_reviews in sync
-- ---------------------------------------------------------------------------
create or replace function public.refresh_product_review_aggregates(p_product_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt integer;
  avg_r numeric(4, 2);
begin
  select
    count(*)::integer,
    case
      when count(*) = 0 then null
      else round(avg(rating::numeric), 2)
    end
  into cnt, avg_r
  from public.product_reviews
  where product_id = p_product_id;

  update public.products
  set
    total_reviews = coalesce(cnt, 0),
    average_rating = avg_r
  where id = p_product_id;
end;
$$;

create or replace function public.trg_product_reviews_refresh_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_review_aggregates(old.product_id);
    return old;
  elsif tg_op = 'UPDATE' then
    if old.product_id is distinct from new.product_id then
      perform public.refresh_product_review_aggregates(old.product_id);
    end if;
    perform public.refresh_product_review_aggregates(new.product_id);
    return new;
  else
    perform public.refresh_product_review_aggregates(new.product_id);
    return new;
  end if;
end;
$$;

drop trigger if exists product_reviews_refresh_aggregates on public.product_reviews;
create trigger product_reviews_refresh_aggregates
  after insert or update or delete on public.product_reviews
  for each row
  execute function public.trg_product_reviews_refresh_aggregates();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.product_reviews enable row level security;

-- Marketplace: anyone can read reviews (product detail / profiles)
drop policy if exists "product_reviews_select_marketplace" on public.product_reviews;
create policy "product_reviews_select_marketplace"
  on public.product_reviews for select
  to anon, authenticated
  using (true);

-- Insert: valid buyer â€” not the listing owner
drop policy if exists "product_reviews_insert_by_buyer" on public.product_reviews;
create policy "product_reviews_insert_by_buyer"
  on public.product_reviews for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.products p
      where p.id = product_id
        and p.seller_id is distinct from auth.uid()
    )
  );

-- Update / delete: author only
drop policy if exists "product_reviews_update_own" on public.product_reviews;
create policy "product_reviews_update_own"
  on public.product_reviews for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "product_reviews_delete_own" on public.product_reviews;
create policy "product_reviews_delete_own"
  on public.product_reviews for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Optional: backfill aggregates for existing products (safe if no reviews yet)
-- ---------------------------------------------------------------------------
update public.products p
set
  total_reviews = coalesce(s.cnt, 0),
  average_rating = s.avg_r
from (
  select
    product_id,
    count(*)::int as cnt,
    case when count(*) = 0 then null else round(avg(rating::numeric), 2) end as avg_r
  from public.product_reviews
  group by product_id
) s
where p.id = s.product_id;


-- ========== 20260422120000_chatbot_learning.sql ==========

-- GreenHub: multilingual chatbot learning (training pairs, feedback, conversation log).
-- Note: public.conversations is reserved for buyer/seller DMs. Bot turns live in chatbot_conversations.

-- ---------------------------------------------------------------------------
-- 1. training_data â€” intents, pattern phrases, responses; admin approval gate
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
-- 2. user_feedback â€” thumbs, wrong-response corrections, learning signals
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
-- 3. chatbot_conversations â€” each row = one user message + bot reply
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


-- ========== 20260423120000_notifications_rls_peer_message_inserts.sql ==========

-- Chat sends failed with "Message not sent" because notify_recipient_on_new_message()
-- (after insert on chat_messages) inserts into notifications with user_id = recipient.
-- RLS policy notifications_insert_own only allows user_id = auth.uid(); the session user
-- is still the sender, so the insert violated policy and rolled back the whole message insert.

drop policy if exists "notifications_insert_peer_message" on public.notifications;

create policy "notifications_insert_peer_message"
  on public.notifications for insert
  to authenticated
  with check (
    type = 'message'
    and exists (
      select 1
      from public.conversations c
      where (c.buyer_id = auth.uid() and c.seller_id = user_id)
         or (c.seller_id = auth.uid() and c.buyer_id = user_id)
    )
  );


-- ========== 20260424120000_notifications_add_data_if_missing.sql ==========

-- Legacy DBs may have `notifications` without `data`; trigger + app expect jsonb payload.
alter table public.notifications
  add column if not exists data jsonb not null default '{}';

comment on column public.notifications.data is
  'Payload for routing (e.g. message: conversation_id, message_id, sender_id).';


-- ========== 20260425120000_chatbot_seed_training_multilingual.sql ==========

-- Seed approved multilingual training_data for the floating chatbot (buy, sell, delivery, payment, verification, support).
-- Idempotent: fixed UUIDs with ON CONFLICT DO UPDATE.

insert into public.training_data (id, intent, patterns, responses, language, approved)
values
  (
    'b1000001-0000-4000-8000-000000000001'::uuid,
    'help_buy_greenhub',
    array[
      'how to buy on greenhub',
      'how do i buy',
      'buying on greenhub',
      'purchase products',
      'place an order',
      'checkout process',
      'add to cart',
      'shop on greenhub',
      'order items',
      'buy from seller',
      'browse and buy',
      'make a purchase'
    ],
    array[
      'To buy on GreenHub: browse categories or search for a product, open the listing, choose quantity or options, then use Add to cart or Buy now. At checkout, enter your delivery address and pay with a supported method. You can message the seller from the product page if you need more details.',
      'Buying is simple: find what you need, add it to your cart, go to checkout, confirm delivery details, and complete payment. Your order status updates in your account.',
      'Start from the home page or search, pick a product you trust, review price and seller info, then proceed to checkout and pay securely.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000002'::uuid,
    'help_sell_greenhub',
    array[
      'how to sell on greenhub',
      'how do i sell',
      'become a seller',
      'list products',
      'create listing',
      'seller account',
      'start selling',
      'post products',
      'vendor on greenhub',
      'open a shop'
    ],
    array[
      'To sell on GreenHub: create or upgrade to a seller profile, complete verification if required, then use Sell or Add product from your dashboard. Add clear photos, accurate prices, stock, and delivery areas. Respond quickly to buyer messages to build trust.',
      'Sellers list items with good photos and descriptions, set delivery options, and get paid according to GreenHubâ€™s payment rules. Keep your profile and inventory up to date.',
      'After your seller setup is approved, add products one by one or in bulk where supported, and monitor orders and messages from buyers.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000003'::uuid,
    'help_delivery',
    array[
      'delivery options',
      'how does delivery work',
      'shipping',
      'when will my order arrive',
      'delivery time',
      'delivery fee',
      'pickup',
      'courier',
      'dispatch',
      'track order'
    ],
    array[
      'Delivery depends on the seller and your location. At checkout you will see available options (for example standard or express) and any delivery fee before you pay. After purchase, check My orders for status updates; tracking appears when the seller or courier provides it.',
      'Sellers set which areas they ship to and estimated timelines. If something is unclear, open the product and message the seller before ordering.',
      'If a delivery issue arises, contact the seller first through GreenHub chat, then use support if you still need help.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000004'::uuid,
    'help_payment',
    array[
      'payment methods',
      'how to pay',
      'pay for order',
      'card payment',
      'bank transfer',
      'cash on delivery',
      'cod',
      'wallet',
      'refund payment'
    ],
    array[
      'Supported payment methods are shown at checkout (for example card, bank transfer, or mobile money depending on your region). You only pay after you confirm the order summary. Refunds, when applicable, follow GreenHub and the seller stated policy.',
      'Choose your payment option on the checkout page, complete the secure flow, and keep your receipt or confirmation in My orders.',
      'Never send money outside GreenHubâ€™s official checkout unless the product flow explicitly allows it; that protects you and keeps support able to help.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000005'::uuid,
    'help_verification',
    array[
      'account verification',
      'verify my account',
      'kyc',
      'identity verification',
      'seller verification',
      'verified badge',
      'upload id',
      'confirm identity'
    ],
    array[
      'Verification helps buyers and GreenHub trust sellers and higher-risk actions. In Account or Seller settings, follow the prompts to submit required documents; status updates appear in the app. A verified badge may show once review passes.',
      'Use clear photos of requested IDs and matching profile details. If verification fails, read the message and resubmit corrected documents.',
      'Verification requirements can differ for buyers, sellers, and payoutsâ€”check the inâ€‘app checklist for your role.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000006'::uuid,
    'help_support',
    array[
      'contact support',
      'customer service',
      'help center',
      'report a problem',
      'speak to someone',
      'email support',
      'complaint',
      'dispute'
    ],
    array[
      'For help: use Help or Contact in the app footer or settings, or reply through your existing order or chat thread. Include your order ID and screenshots when reporting a problem so we can resolve it faster.',
      'Many issues are fastest if you message the seller first. If you still need GreenHub support, reach out through the official contact options shown in the app.',
      'Do not share passwords or full card numbers in chat; support will never ask for your password.'
    ],
    'en',
    true
  ),

  -- YorÃ¹bÃ¡
  (
    'b1000001-0000-4000-8000-000000000007'::uuid,
    'help_buy_greenhub',
    array[
      'bii á¹£e mo á¹£e ra lori greenhub',
      'bawo ni mo á¹£e le ra',
      'ra lori greenhub',
      'ra awá»n á»ja',
      'fi si káº¹káº¹',
      'sanwo',
      'á¹£iá¹£áº¹ ra',
      'iranlowo ra'
    ],
    array[
      'Lati ra lori GreenHub: á¹£awari tabi á¹£e ayáº¹wo fun á»ja, á¹£ii akosile naa, yan iye, láº¹na Fi si káº¹káº¹ tabi Ra bayi. Ni ideri, fi adiráº¹si ráº¹ sii ki o sanwo páº¹lu á»na ti o á¹£e atiláº¹yin. O le fi ifiraná¹£áº¹ ran á»ja ti o ta.',
      'á¹¢awari, fi si káº¹káº¹, lá» si ideri, jáº¹ri imudojuiwá»n, ki o sanwo ni aabo. Ipo ibáº¹ráº¹ ráº¹ wa ni aká»á»láº¹ ráº¹.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000008'::uuid,
    'help_sell_greenhub',
    array[
      'bii á¹£e mo á¹£e ta lori greenhub',
      'oloja greenhub',
      'fi á»ja han',
      'á¹£iá¹£áº¹ ta',
      'iwe oja',
      'á¹£iá¹£áº¹ olota'
    ],
    array[
      'Lati ta: á¹£áº¹da profaili olota, pari ijáº¹risi ti o ba nilo, láº¹na Ta tabi Fi á»ja kun lati dashboard. Fi aworan ati apejuwe to peye, owo, ati agbegbe isinmi. Dahun awá»n ifiraná¹£áº¹ ni kiakia.',
      'Awá»n olota á¹£e akosile páº¹lu aworan dara, á¹£eto awá»n aá¹£ayan isinmi, ki o táº¹táº¹ si awá»n ibáº¹ráº¹.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000009'::uuid,
    'help_delivery',
    array[
      'isinmi',
      'bii á¹£e isinmi á¹£e á¹£iá¹£áº¹',
      'gbigbe',
      'akoko isinmi',
      'owo isinmi',
      'lati ra de á»dá» mi'
    ],
    array[
      'Isinmi duro lori olota ati adiráº¹si ráº¹. Ni ideri iwá» yoo rii awá»n aá¹£ayan ati owo isinmi á¹£aaju sanwo. á¹¢ayáº¹wo Awá»n ibáº¹ráº¹ mi fun ipo.',
      'Ti o ba ni ibeere, fi ifiraná¹£áº¹ ran olota ká»ja áº¹rá» GreenHub á¹£aaju ibáº¹ráº¹.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000a'::uuid,
    'help_payment',
    array[
      'owo sisan',
      'bawo ni mo á¹£e le sanwo',
      'kadi',
      'á¹£iá¹£áº¹san banki',
      'sanwo fun ibáº¹ráº¹'
    ],
    array[
      'Awá»n á»na sisan ni a á¹£e han ni ideri (kadi, á¹£iá¹£áº¹san banki, tabi owo elo ibi ti o ba wulo). Sanwo nikan láº¹hin ti o ba á¹£atuná¹£e ibáº¹ráº¹ ráº¹.',
      'Maá¹£e fi owo ran áº¹nikan ni ita checkout ti o ni igbáº¹káº¹le.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000b'::uuid,
    'help_verification',
    array[
      'ijáº¹risi aká»á»láº¹',
      'jáº¹risi olota',
      'wá»le ni idanimá»',
      'fifiraná¹£áº¹ id'
    ],
    array[
      'Ijáº¹risi á¹£e iranlá»wá» fun olugbáº¹káº¹le. Ni Eto aká»á»láº¹ táº¹le awá»n ilana, fi aworan ti o han gbangba siláº¹. Ami ijáº¹risi le han ti o ba táº¹táº¹.',
      'Lo aworan ti o yatá» ati alaye ti o ba mu.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000c'::uuid,
    'help_support',
    array[
      'iranlowo',
      'kan si atiláº¹yin',
      'iroyin isoro',
      'sá»rá» páº¹lu áº¹nikan'
    ],
    array[
      'Fun iranlowo: lo Iranlowo tabi Kan si wa ni app, tabi fi ifiraná¹£áº¹ ran nipasáº¹ ibáº¹ráº¹ ráº¹. Fi ID ibáº¹ráº¹ ati aworan kun.',
      'á»Œpá»lá»pá» isoro ni yara ti o ba fi ifiraná¹£áº¹ ran olota aká»ká».'
    ],
    'yo',
    true
  ),

  -- Igbo
  (
    'b1000001-0000-4000-8000-00000000000d'::uuid,
    'help_buy_greenhub',
    array[
      'otu e si azá»¥ na greenhub',
      'kedu ka m ga esi azá»¥',
      'á»‹zá»¥ na greenhub',
      'tinye na kaadá»‹',
      'kwá»¥á» á»¥gwá»',
      'á»‹zá»¥ ihe'
    ],
    array[
      'Iji zá»¥ta na GreenHub: chá»á» ma á» bá»¥ lelee ngwaahá»‹a, mepee ndepá»¥ta, há»rá» á»tá»¥tá»¥, tinye na Kaadá»‹ ma á» bá»¥ Zá»¥ta ugbu a. Na nkwá»¥sá»‹tá»¥, tinye adreesá»‹ gá»‹ ma kwá»¥á» á»¥gwá». á»Š nwere ike ozi onye na-ere ahá»‹a site na ibe ngwaahá»‹a.',
      'Chá»á», tinye na kaadá»‹, gaa na nkwá»¥sá»‹tá»¥, kwado nnyefe, kwá»¥á» á»¥gwá» nke á»ma. á»Œná»dá»¥ gá»‹ dá»‹ na akaá»¥ntá»¥ gá»‹.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000e'::uuid,
    'help_sell_greenhub',
    array[
      'otu e si ree na greenhub',
      'onye na-ere ahá»‹a',
      'ndepá»¥ta ngwaahá»‹a',
      'malite ire',
      'á»¥lá» ahá»‹a'
    ],
    array[
      'Iji ree: mepá»¥ta profaá»‹lá»¥ onye na-ere, mezue nkwenye á» bá»¥rá»¥ na achá»rá», tinye ngwaahá»‹a site na Ree. Tinye foto na nká»wa zuru oke, á»ná»¥ahá»‹a, na mpaghara nnyefe.',
      'Ndá»‹ na-ere na-ahazi nnyefe na nzaghachi ozi ndá»‹ na-azá»¥ ozugbo.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000000f'::uuid,
    'help_delivery',
    array[
      'nnyefe',
      'otu nnyefe si ará»¥ á»rá»¥',
      'á»¥gbá» mmiri',
      'oge nnyefe',
      'á»¥gwá» nnyefe'
    ],
    array[
      'Nnyefe dabere na onye na-ere na ebe á»‹ ná». Na nkwá»¥sá»‹tá»¥ á»‹ ga-ahá»¥ nhá»rá» na á»¥gwá» tupu á»‹kwá»¥ á»¥gwá». Lelee Iwu m maka á»ná»dá»¥.',
      'Ozi onye na-ere ma á»‹ nwere ajá»¥já»¥ tupu á»‹zá»¥ta.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000010'::uuid,
    'help_payment',
    array[
      'á»¥zá» á»‹kwá»¥ á»¥gwá»',
      'kedu ka m ga esi kwá»¥á» á»¥gwá»',
      'kaadá»‹',
      'á»¥gwá» á»¥lá» aká»¥',
      'kwá»¥á» á»¥gwá» maka iwu'
    ],
    array[
      'á»¤zá» á»‹kwá»¥ á»¥gwá» na-egosi na nkwá»¥sá»‹tá»¥ (kaadá»‹, nyefe á»¥lá» aká»¥, ego mkpanaka dá»‹ ka á» dabara). Kwá»¥á» á»¥gwá» mgbe á»‹ kwadoro iwu gá»‹.',
      'Echekwaba na á»‹ na-eji á»rá»¥ GreenHub zuru oke.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000011'::uuid,
    'help_verification',
    array[
      'nkwenye akaá»¥ntá»¥',
      'nkwenye onye na-ere',
      'njirimara',
      'tinye id'
    ],
    array[
      'Nkwenye na-enyere ndá»‹ na-azá»¥ aka. Na Ntá»ala akaá»¥ntá»¥ soro ntá»¥zi tinye nyocha dá»‹ mkpa. Agá»¥á» nwere ike á»‹pá»¥ta mgbe emechara.',
      'Jiri foto doro anya na ozi dabara adaba.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000012'::uuid,
    'help_support',
    array[
      'enyemaka',
      'ká»ntaktá»‹',
      'ká»waa nsogbu',
      'kwuo na onye'
    ],
    array[
      'Maka enyemaka: jiri Enyemaka ma á» bá»¥ Ká»ntaktá»‹ na ngwa ma á» bá»¥ ziga ozi site na iwu gá»‹. Tinye ID iwu na ihe onyonyo.',
      'á»Œtá»¥tá»¥ nsogbu na-aga ngwa ngwa ma á»‹ ziga ozi onye na-ere mbá»¥.'
    ],
    'ig',
    true
  ),

  -- Hausa
  (
    'b1000001-0000-4000-8000-000000000013'::uuid,
    'help_buy_greenhub',
    array[
      'yaya a saya a greenhub',
      'yaya zan iya saya',
      'saya a greenhub',
      'sanya a cikin keÉ—e',
      'biyan kuÉ—i',
      'sayayya'
    ],
    array[
      'Don saya a GreenHub: bincika ko nemi samfur, buÉ—e jerin, zaÉ“i adadin, sannan Sanya a keÉ—e ko Saya yanzu. A biyan kuÉ—i, shigar da adireshi kuma biya ta hanyar da ake goyan baya. Kuna iya aika saÆ™on zuwa mai sayarwa daga shafin samfur.',
      'Nemi, sanya a keÉ—e, je zuwa biyan kuÉ—i, tabbatar da isarwa, kuma biya cikin aminci. Matsayin odar ku yana a cikin asusun ku.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000014'::uuid,
    'help_sell_greenhub',
    array[
      'yaya a sayar da greenhub',
      'mai sayarwa',
      'jerin samfura',
      'fara sayarwa',
      'kantin sayarwa'
    ],
    array[
      'Don sayarwa: Æ™irÆ™iri bayanin mai sayarwa, kammala tabbatarwa idan ana buÆ™ata, sannan Sayar ko Æ˜ara samfur daga fuskar mai gida. Saka hotuna da bayani masu inganci, farashi, da yankunan isarwa.',
      'Masu sayarwa suna saita isarwa kuma suna amsa saÆ™onnan saye da sauri.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000015'::uuid,
    'help_delivery',
    array[
      'isarwa',
      'yaya isarwa take aiki',
      'jirgin ruwa',
      'lokacin isarwa',
      'kudin isarwa'
    ],
    array[
      'Isarwa ta dogara da mai sayarwa da wurin ku. A biyan kuÉ—i za ku ga zaÉ“uÉ“É“uka da kudin kafin biya. Duba Odar na don matsayi.',
      'Aika saÆ™on zuwa mai sayarwa idan kuna da tambaya kafin odar.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000016'::uuid,
    'help_payment',
    array[
      'hanyoyin biyan kuÉ—i',
      'yaya zan biya',
      'katin banki',
      'wucewa banki',
      'biyan odar'
    ],
    array[
      'Hanyoyin biyan kuÉ—i suna bayyana a biyan kuÉ—i (katin banki, wucewa, kuÉ—in waya, da sauransu). Biya bayan tabbatar da odar.',
      'Kada ku aika kuÉ—i a wajen biyan kuÉ—i na GreenHub ba tare da tabbaci ba.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000017'::uuid,
    'help_verification',
    array[
      'tabbatar da asusu',
      'tabbatar da mai sayarwa',
      'tantancewa',
      'loda id'
    ],
    array[
      'Tabbatarwa tana taimakawa ga masu sayayya. A Saitunan asusu bi umarnin, loda takardu masu inganci. Alamar tabbatarwa zata iya bayyana bayan bita.',
      'Yi amfani da hotuna masu kyau da bayani daidai.'
    ],
    'ha',
    true
  ),
  (
    'b1000001-0000-4000-8000-000000000018'::uuid,
    'help_support',
    array[
      'goyan baya',
      'tuntuÉ“ar mu',
      'bayar da rahoton matsala',
      'magana da wani'
    ],
    array[
      'Don taimako: yi amfani da Taimako ko TuntuÉ“ar mu a cikin manhaja ko aika saÆ™on ta hanyar odar ku. HaÉ—a lambar odar da hotuna.',
      'Yawancin matsaloli sun fi sauri idan kun tuntuÉ“i mai sayarwa da farko.'
    ],
    'ha',
    true
  )
on conflict (id) do update set
  intent = excluded.intent,
  patterns = excluded.patterns,
  responses = excluded.responses,
  language = excluded.language,
  approved = excluded.approved;


-- ========== 20260426120000_products_images_text_array.sql ==========

-- Multiple product images: gallery URLs stored as TEXT[]; legacy `image` remains primary/first for compatibility.
alter table public.products add column if not exists images text[] not null default '{}';

comment on column public.products.images is 'Ordered public URLs for product gallery (max 5 in app); first matches image when synced.';

-- Backfill gallery from legacy `image` when the array is still empty.
update public.products
set images = array[trim(image)]::text[]
where image is not null
  and trim(image) <> ''
  and cardinality(images) = 0;


-- ========== 20260427120000_chatbot_boost_listing_training.sql ==========

-- Intent: paid listing boost / advertise (seller) vs shopper checkout â€” improves smart-match for â€œboostâ€, â€œadvertiseâ€, etc.

insert into public.training_data (id, intent, patterns, responses, language, approved)
values
  (
    'b1000001-0000-4000-8000-000000000019'::uuid,
    'help_boost_listing',
    array[
      'boost listing',
      'boost my product',
      'boost my listing',
      'advertise listing',
      'advertise product',
      'promote listing',
      'paid visibility',
      'seller boost',
      'paystack boost',
      'boost tier',
      'visibility boost',
      'sponsored listing',
      'featured listing',
      'how to boost',
      'how do i boost',
      'increase visibility listing'
    ],
    array[
      'Boosting is for sellers: it is a separate paid option to show your listing higher in search and feeds. It is not the same as a customer buying a product. Open Seller â†’ Advertise (or your productâ€™s Boost options), pick a tier, and pay through the secure flow.',
      'If you are selling: use Boost or Advertise on your product to extend visibility for a period. If you are shopping: use Add to cart and checkoutâ€”that is buying, not boosting.',
      'Need help with checkout as a buyer? Ask about buying or orders. Need more eyes on your stock? Use Advertise / Boost from the seller dashboard.'
    ],
    'en',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000001a'::uuid,
    'help_boost_listing',
    array[
      'mu akosile han',
      'imudara ifihan',
      'ipolongo akosile',
      'boost olota',
      'boost lori greenhub',
      'bii á¹£e mo á¹£e boost',
      'fi akosile han siwaju',
      'sanwo fun ifihan'
    ],
    array[
      'Imudara ifihan fun awá»n olota nikan: o jáº¹ aá¹£ayan ti a san fun lati mu akosile ráº¹ han siwaju ni awá»n abajade. Ko jáº¹ bii ti onibara ti o n ra á»ja. Lá» si Olota â†’ Ipolongo tabi awá»n aá¹£ayan Boost, yan ipele, ki o sanwo.',
      'Ti o ba jáº¹ olota: lo Boost tabi Ipolongo lori á»ja ráº¹. Ti o ba jáº¹ onibara: lo Fi si káº¹káº¹ ati ideriâ€”iyáº¹n jáº¹ ra, kii á¹£e imudara ifihan.'
    ],
    'yo',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000001b'::uuid,
    'help_boost_listing',
    array[
      'ime ka á»pá»¥rá»¥iche',
      'mgbasa ozi ngwaahá»‹a',
      'boost onye na-ere',
      'boost na greenhub',
      'otu e si mee ka a há»¥ á»kachamara',
      'á»‹kwá»¥ á»¥gwá» maka á»pá»¥rá»¥iche'
    ],
    array[
      'Ime ka á»pá»¥rá»¥iche bá»¥ maka ndá»‹ na-ere: á» bá»¥ nhá»rá» dá»‹ iche e kwá»¥á» á»¥gwá» maka ka a há»¥ ngwaahá»‹a gá»‹ nke á»ma. á»Œ bá»¥ghá»‹ otu á»‹zá»¥ dá»‹ ka onye na-azá»¥ ahá»‹a. Gaa na Onye na-ere â†’ Mgbasa ozi ma á» bá»¥ nhá»rá» Boost, há»rá» ogo, kwá»¥á» á»¥gwá».',
      'á»Œ bá»¥rá»¥ na á»‹ na-ere: jiri Boost ma á» bá»¥ Mgbasa ozi. á»Œ bá»¥rá»¥ na á»‹ na-azá»¥: jiri á»¥gbá» ala na nkwá»¥á»â€”á»‹zá»¥, á» bá»¥ghá»‹ ime ka á»pá»¥rá»¥iche.'
    ],
    'ig',
    true
  ),
  (
    'b1000001-0000-4000-8000-00000000001c'::uuid,
    'help_boost_listing',
    array[
      'Æ™arfafa samfurin',
      'talla mai biya',
      'boost mai sayarwa',
      'boost a greenhub',
      'yaya zan Æ™arfafa samfurin',
      'biyan kuÉ—i don ganin samfurin'
    ],
    array[
      'Æ˜arfafa shine don masu sayarwa: wannan babi ne daban da biyan kuÉ—i don sayayya. Kuna biyan kuÉ—i don samfurin ku ya bayyana sama a bincike. Ba haka yadda mai sayayya ke sayen kayan ba. Je Mai sayarwa â†’ Talla ko Boost, zaÉ“i matakin ku, biya.',
      'Idan kuna sayarwa: amfani da Boost ko Talla. Idan kuna sayayya: amfani da kanti da biyan kuÉ—iâ€”wannan sayayya ce, ba Æ™arfafa ba.'
    ],
    'ha',
    true
  )
on conflict (id) do update set
  intent = excluded.intent,
  patterns = excluded.patterns,
  responses = excluded.responses,
  language = excluded.language,
  approved = excluded.approved;


-- ========== 20260428120000_profile_follows.sql ==========

-- GreenHub: one-way follows between members (social layer).
-- Run via supabase db push / migration pipeline.

create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint profile_follows_no_self check (follower_id <> following_id)
);

create index if not exists profile_follows_following_id_idx on public.profile_follows (following_id);
create index if not exists profile_follows_follower_id_idx on public.profile_follows (follower_id);

comment on table public.profile_follows is 'Directed follow edges: follower_id follows following_id.';

alter table public.profile_follows enable row level security;

-- Members can create/delete only their own follow relationships.
drop policy if exists "profile_follows_insert_own" on public.profile_follows;
create policy "profile_follows_insert_own"
  on public.profile_follows for insert to authenticated
  with check (follower_id = auth.uid());

drop policy if exists "profile_follows_delete_own" on public.profile_follows;
create policy "profile_follows_delete_own"
  on public.profile_follows for delete to authenticated
  using (follower_id = auth.uid());

-- Each user can read rows where they are the follower or the person being followed
-- (enough to know "am I following X?" without exposing everyone who follows X).
drop policy if exists "profile_follows_select_involved" on public.profile_follows;
create policy "profile_follows_select_involved"
  on public.profile_follows for select to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

-- Public aggregate counts (no leak of follower lists to unrelated users).
create or replace function public.profile_follower_count(p_user_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from public.profile_follows where following_id = p_user_id;
$$;

create or replace function public.profile_following_count(p_user_id uuid)
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::bigint from public.profile_follows where follower_id = p_user_id;
$$;

comment on function public.profile_follower_count is 'Number of users following p_user_id; callable without seeing individual follower rows.';
comment on function public.profile_following_count is 'Number of users p_user_id follows.';

grant execute on function public.profile_follower_count(uuid) to anon, authenticated;
grant execute on function public.profile_following_count(uuid) to anon, authenticated;

grant select, insert, delete on table public.profile_follows to authenticated;


-- ========== 20260429120000_complimentary_ads_subscriber_boost.sql ==========

-- Complimentary listing boosts for designated seller emails (JWT email must match).
-- Add more emails in the CASE expression if needed.

create or replace function public.apply_complimentary_ads_boost(
  p_product_id bigint,
  p_tier text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_uid uuid := auth.uid();
  v_seller uuid;
  v_until timestamptz;
  v_days int;
  v_ref text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Allowed complimentary ads accounts (must match Supabase Auth primary email).
  if v_email is null or v_email <> 'liondecafe@gmail.com' then
    raise exception 'not authorized for complimentary boosts';
  end if;

  if p_tier not in ('daily', 'weekly', 'monthly', 'yearly') then
    raise exception 'invalid tier';
  end if;

  v_days := case p_tier
    when 'daily' then 1
    when 'weekly' then 7
    when 'monthly' then 30
    when 'yearly' then 365
  end;

  select seller_id into v_seller from public.products where id = p_product_id;
  if v_seller is null then
    raise exception 'product not found';
  end if;
  if v_seller <> v_uid then
    raise exception 'not your listing';
  end if;

  select
    case
      when boost_expires_at is not null and boost_expires_at > now()
      then boost_expires_at + (v_days::text || ' days')::interval
      else now() + (v_days::text || ' days')::interval
    end
  into v_until
  from public.products
  where id = p_product_id;

  update public.products
  set
    boost_expires_at = v_until,
    boost_tier = p_tier,
    boost_count = coalesce(boost_count, 0) + 1,
    priority_score = 100,
    updated_at = now()
  where id = p_product_id;

  v_ref := 'complimentary-ads-' || gen_random_uuid()::text;

  insert into public.boost_transactions (
    seller_id,
    product_id,
    amount,
    duration_days,
    boost_tier,
    payment_reference,
    status,
    notes
  ) values (
    v_seller,
    p_product_id,
    0,
    v_days,
    p_tier,
    v_ref,
    'success',
    'Complimentary ads subscriber (JWT email allowlist)'
  );

  return json_build_object('ok', true, 'boost_expires_at', v_until);
end;
$$;

comment on function public.apply_complimentary_ads_boost is
  'Applies a paid-style boost without Paystack for allowlisted seller emails; enforced server-side via JWT email.';

grant execute on function public.apply_complimentary_ads_boost(bigint, text) to authenticated;


-- ========== 20260430120000_testing_free_ads_runtime_settings.sql ==========

-- Testing: optional 7-day (configurable) complimentary boosts for ANY authenticated seller.
-- When testing_free_ads is false, only liondecafe@gmail.com gets complimentary boosts (allowlist).

create table if not exists public.runtime_settings (
  id smallint primary key default 1 constraint runtime_settings_singleton check (id = 1),
  testing_free_ads boolean not null default true,
  testing_free_ads_days int not null default 7,
  updated_at timestamptz not null default now()
);

comment on table public.runtime_settings is
  'Singleton app flags. testing_free_ads: any seller may use apply_complimentary_ads_boost for N days without Paystack.';

insert into public.runtime_settings (id, testing_free_ads, testing_free_ads_days)
values (1, true, 7)
on conflict (id) do nothing;

alter table public.runtime_settings enable row level security;

drop policy if exists "runtime_settings_select_authenticated" on public.runtime_settings;
create policy "runtime_settings_select_authenticated"
  on public.runtime_settings for select
  to authenticated
  using (true);

drop policy if exists "runtime_settings_select_anon" on public.runtime_settings;
create policy "runtime_settings_select_anon"
  on public.runtime_settings for select
  to anon
  using (true);

-- No user updates via API; change flags in SQL when turning off testing.

create or replace function public.apply_complimentary_ads_boost(
  p_product_id bigint,
  p_tier text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_uid uuid := auth.uid();
  v_seller uuid;
  v_until timestamptz;
  v_days int;
  v_tier text;
  v_ref text;
  v_testing boolean := false;
  v_testing_days int := 7;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(rs.testing_free_ads, false), greatest(1, coalesce(rs.testing_free_ads_days, 7))
  into v_testing, v_testing_days
  from public.runtime_settings rs
  where rs.id = 1;

  if not found then
    v_testing := false;
    v_testing_days := 7;
  end if;

  if v_testing then
    v_days := v_testing_days;
    v_tier := 'weekly';
  else
    if v_email is null or v_email <> 'liondecafe@gmail.com' then
      raise exception 'not authorized for complimentary boosts';
    end if;

    if p_tier not in ('daily', 'weekly', 'monthly', 'yearly') then
      raise exception 'invalid tier';
    end if;

    v_tier := p_tier;
    v_days := case p_tier
      when 'daily' then 1
      when 'weekly' then 7
      when 'monthly' then 30
      when 'yearly' then 365
    end;
  end if;

  select seller_id into v_seller from public.products where id = p_product_id;
  if v_seller is null then
    raise exception 'product not found';
  end if;
  if v_seller <> v_uid then
    raise exception 'not your listing';
  end if;

  select
    case
      when boost_expires_at is not null and boost_expires_at > now()
      then boost_expires_at + (v_days::text || ' days')::interval
      else now() + (v_days::text || ' days')::interval
    end
  into v_until
  from public.products
  where id = p_product_id;

  update public.products
  set
    boost_expires_at = v_until,
    boost_tier = v_tier,
    boost_count = coalesce(boost_count, 0) + 1,
    priority_score = 100,
    updated_at = now()
  where id = p_product_id;

  v_ref := case when v_testing then 'testing-free-ads-' else 'complimentary-ads-' end || gen_random_uuid()::text;

  insert into public.boost_transactions (
    seller_id,
    product_id,
    amount,
    duration_days,
    boost_tier,
    payment_reference,
    status,
    notes
  ) values (
    v_seller,
    p_product_id,
    0,
    v_days,
    v_tier,
    v_ref,
    'success',
    case
      when v_testing then format('Testing free ads (%s days)', v_days)
      else 'Complimentary ads subscriber (JWT email allowlist)'
    end
  );

  return json_build_object('ok', true, 'boost_expires_at', v_until);
end;
$$;

comment on function public.apply_complimentary_ads_boost is
  'Complimentary boosts: if runtime_settings.testing_free_ads, any seller gets N days (weekly tier label); else only liondecafe@gmail.com with Paystack-style tier durations.';

grant execute on function public.apply_complimentary_ads_boost(bigint, text) to authenticated;


-- ========== 20260431120000_ensure_products_average_rating_columns.sql ==========

-- Fixes: column f.average_rating does not exist (rpc_products_listing) when an older DB
-- had boost_system applied without products.average_rating / total_reviews.
alter table public.products
  add column if not exists average_rating numeric(4, 2) null,
  add column if not exists total_reviews integer not null default 0;


-- ========== 20260431140000_chat_messages_delivery_status.sql ==========

-- Per-message delivery receipts: sent â†’ delivered â†’ read (recipient updates only).

alter table public.chat_messages
  add column if not exists status text not null default 'sent',
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

alter table public.chat_messages drop constraint if exists chat_messages_status_check;
alter table public.chat_messages
  add constraint chat_messages_status_check
  check (status in ('sent', 'delivered', 'read'));

comment on column public.chat_messages.status is 'Delivery state from sender POV: sent (persisted), delivered (recipient device), read (recipient opened thread).';
comment on column public.chat_messages.delivered_at is 'Set when recipient client receives the message.';
comment on column public.chat_messages.read_at is 'Set when recipient has read the message (chat opened / marked read).';

-- Recipients may update receipt fields only (enforced in trigger).
drop policy if exists "chat_messages_update_recipient_receipts" on public.chat_messages;
create policy "chat_messages_update_recipient_receipts"
  on public.chat_messages
  for update
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and c.id is not null
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
    and sender_id is distinct from auth.uid()
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
    and sender_id is distinct from auth.uid()
  );

create or replace function public.chat_messages_enforce_receipt_columns_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.sender_id is not distinct from auth.uid() then
    raise exception 'Only the recipient can update delivery receipts'
      using errcode = '42501';
  end if;

  if new.message is distinct from old.message
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
  then
    raise exception 'Recipients may only change status, delivered_at, read_at'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_chat_messages_receipt_columns_only on public.chat_messages;
create trigger trg_chat_messages_receipt_columns_only
  before update on public.chat_messages
  for each row
  execute function public.chat_messages_enforce_receipt_columns_only();

grant update on table public.chat_messages to authenticated;

-- Batch mark inbound messages delivered (recipient device).
create or replace function public.mark_conversation_messages_delivered(p_conversation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.chat_messages m
  set
    delivered_at = coalesce(m.delivered_at, now()),
    status =
      case
        when m.read_at is not null then 'read'
        else 'delivered'
      end
  from public.conversations c
  where m.conversation_id = p_conversation_id
    and m.conversation_id = c.id
    and m.sender_id is distinct from auth.uid()
    and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    and m.delivered_at is null;
end;
$$;

-- Batch mark inbound messages read (recipient opened chat).
create or replace function public.mark_conversation_messages_read(p_conversation_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.chat_messages m
  set
    read_at = now(),
    delivered_at = coalesce(m.delivered_at, now()),
    status = 'read'
  from public.conversations c
  where m.conversation_id = p_conversation_id
    and m.conversation_id = c.id
    and m.sender_id is distinct from auth.uid()
    and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    and m.read_at is null;
end;
$$;

grant execute on function public.mark_conversation_messages_delivered(uuid) to authenticated;
grant execute on function public.mark_conversation_messages_read(uuid) to authenticated;

-- Realtime: ensure updates stream to clients (idempotent if already member).
do $$
begin
  begin
    alter publication supabase_realtime add table public.chat_messages;
  exception
    when duplicate_object then null;
  end;
end $$;


-- ========== 20260501140000_repair_engagement_notifications_reviews.sql ==========

-- Repair engagement notification insert policies.
-- Safe to run more than once.
--
-- Note: the earlier `product_sold` policy is intentionally not recreated here
-- because this database currently does not have `public.order_items`.

drop policy if exists "notifications_insert_product_like" on public.notifications;
create policy "notifications_insert_product_like"
  on public.notifications for insert
  to authenticated
  with check (
    type = 'product_like'
    and data->>'actor_user_id' = auth.uid()::text
    and exists (
      select 1
      from public.products p
      where p.id::text = data->>'product_id'
        and p.seller_id = notifications.user_id
        and p.seller_id <> auth.uid()
    )
  );

drop policy if exists "notifications_insert_profile_follow" on public.notifications;
create policy "notifications_insert_profile_follow"
  on public.notifications for insert
  to authenticated
  with check (
    type = 'profile_follow'
    and data->>'follower_id' = auth.uid()::text
    and data->>'following_id' = notifications.user_id::text
    and exists (
      select 1
      from public.profile_follows f
      where f.follower_id = auth.uid()
        and f.following_id = notifications.user_id
    )
  );

drop policy if exists "notifications_insert_boost_expiring" on public.notifications;
create policy "notifications_insert_boost_expiring"
  on public.notifications for insert
  to authenticated
  with check (
    type = 'boost_expiring'
    and exists (
      select 1
      from public.products p
      where p.id::text = data->>'product_id'
        and p.seller_id = notifications.user_id
        and p.seller_id = auth.uid()
    )
  );


-- ========== 20260508120000_create_order_items.sql ==========

-- Create order_items table
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id bigint not null references public.products(id),
  seller_id uuid not null references auth.users(id),
  product_title text not null,
  product_image text,
  quantity integer not null default 1,
  unit_price numeric(10,2) not null,
  total_price numeric(10,2) not null,
  delivery_fee_at_time numeric(10,2),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Add indexes
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_seller_id_idx on public.order_items(seller_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);

-- Enable RLS
alter table public.order_items enable row level security;

-- RLS policies
create policy "Users can view their own order items"
  on public.order_items for select
  to authenticated
  using (seller_id = auth.uid() or exists (
    select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()
  ));

create policy "System can insert order items"
  on public.order_items for insert
  to authenticated
  with check (exists (
    select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()
  ));


-- ========== 20260509120000_like_system_realtime_and_grants.sql ==========

-- Like system hardening: permissions, count backfill, and realtime publication.

alter table public.product_likes enable row level security;

grant select on table public.product_likes to anon, authenticated;
grant insert, delete on table public.product_likes to authenticated;

-- Backfill like_count to avoid drift from historical/manual writes.
with like_totals as (
  select product_id, count(*)::integer as cnt
  from public.product_likes
  group by product_id
)
update public.products p
set like_count = lt.cnt
from like_totals lt
where p.id = lt.product_id
  and coalesce(p.like_count, 0) <> lt.cnt;

update public.products p
set like_count = 0
where coalesce(p.like_count, 0) <> 0
  and not exists (
    select 1
    from public.product_likes pl
    where pl.product_id = p.id
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.products;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;


-- ========== 20260509120000_subcategory_chat_attachments.sql ==========

-- Electronics subcategory + chat-attachments storage bucket (file uploads in chat)

alter table public.products add column if not exists subcategory text;

comment on column public.products.subcategory is
  'When category is electronics, seller sub-type (Laptops, Phones & Tablets, etc.) or custom text for Other.';

-- Public bucket for chat file URLs embedded in messages / image_url
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

-- Listing RPC: filter by subcategory when category is electronics
drop function if exists public.rpc_products_listing(
  text, text, text, text, text, numeric, numeric, text, int, int
);

create or replace function public.rpc_products_listing(
  p_search text default null,
  p_category text default null,
  p_condition text default null,
  p_car_brand text default null,
  p_subcategory text default null,
  p_state text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_sort text default 'recent',
  p_limit int default 12,
  p_offset int default 0
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_rows json;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_cat text := nullif(trim(coalesce(p_category, '')), '');
  v_cond text := nullif(trim(coalesce(p_condition, '')), '');
  v_brand text := nullif(trim(coalesce(p_car_brand, '')), '');
  v_sub text := nullif(trim(coalesce(p_subcategory, '')), '');
  v_state text := nullif(trim(coalesce(p_state, '')), '');
  v_sort text := coalesce(nullif(trim(coalesce(p_sort, '')), ''), 'recent');
begin
  if v_cat in ('all', '') then v_cat := null; end if;
  if v_cond in ('all', '') then v_cond := null; end if;
  if v_brand in ('all', '') then v_brand := null; end if;
  if v_sub in ('all', '') then v_sub := null; end if;
  if v_state in ('all', '') then v_state := null; end if;

  with filtered as (
    select p.*
    from public.products p
    where p.status = 'active'
      and (
        v_search is null
        or p.title ilike '%' || v_search || '%'
      )
      and (v_cat is null or p.category = v_cat)
      and (v_cond is null or p.condition = v_cond)
      and (
        v_brand is null
        or coalesce(v_cat, '') <> 'vehicles'
        or p.car_brand = v_brand
      )
      and (
        v_sub is null
        or coalesce(v_cat, '') <> 'electronics'
        or p.subcategory = v_sub
      )
      and (
        v_state is null
        or p.location ilike '%' || v_state || '%'
      )
      and (p_price_min is null or coalesce(p.price_local, p.price, 0) >= p_price_min)
      and (p_price_max is null or coalesce(p.price_local, p.price, 0) <= p_price_max)
  ),
  counted as (
    select count(*)::bigint as cnt from filtered
  ),
  ordered as (
    select f.*
    from filtered f
    order by
      case
        when f.boost_expires_at is not null and f.boost_expires_at > now() then 0
        else 1
      end,
      coalesce(f.priority_score, 0) desc,
      case when v_sort = 'price-low' then coalesce(f.price_local, f.price, 0) end asc nulls last,
      case when v_sort = 'price-high' then coalesce(f.price_local, f.price, 0) end desc nulls last,
      case
        when v_sort = 'rating'
        then coalesce(f.average_rating, f.rating::numeric, 0)
      end desc nulls last,
      f.created_at desc nulls last
    limit greatest(coalesce(p_limit, 12), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    (select c.cnt from counted c),
    coalesce((select json_agg(to_jsonb(o)) from ordered o), '[]'::json)
  into v_total, v_rows;

  return json_build_object('total', coalesce(v_total, 0), 'rows', v_rows);
end;
$$;

grant execute on function public.rpc_products_listing(
  text, text, text, text, text, text, numeric, numeric, text, int, int
) to anon, authenticated;


-- ========== 20260510120000_profiles_string_columns_coerce_to_text.sql ==========

-- Ensure string-like columns on public.profiles are type `text`.
-- Fixes misconfigured schemas where e.g. avatar_url was created as smallint, which breaks
-- Google OAuth inserts (picture URL) from ensureOAuthProfile.

do $$
declare
  col text;
  typ text;
  cols constant text[] := array[
    'full_name',
    'avatar_url',
    'phone',
    'gender',
    'state',
    'lga',
    'address',
    'email',
    'auto_reply',
    'bio'
  ];
begin
  foreach col in array cols
  loop
    select c.data_type
    into typ
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'profiles'
      and c.column_name = col;

    if typ is null then
      execute format('alter table public.profiles add column %I text', col);
    elsif typ <> 'text' then
      execute format(
        'alter table public.profiles alter column %I type text using %I::text',
        col,
        col
      );
    end if;
  end loop;
end
$$;


-- ========== 20260511120000_chat_messages_image_url.sql ==========

-- Chat image attachments: public URL stored on chat_messages + Storage bucket `chat-images`.

alter table public.chat_messages add column if not exists image_url text;

alter table public.chat_messages alter column message drop not null;

create or replace function public.touch_conversation_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message = left(
      coalesce(
        nullif(trim(coalesce(new.message, '')), ''),
        case
          when new.image_url is not null and trim(coalesce(new.image_url, '')) <> '' then 'Photo'
          else null
        end,
        ''
      ),
      200
    ),
    last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

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
      nullif(trim(coalesce(new.message, '')), ''),
      case
        when new.image_url is not null and trim(coalesce(new.image_url, '')) <> '' then 'Photo'
        else null
      end,
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

insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', true)
on conflict (id) do nothing;

drop policy if exists "Chat images are publicly readable" on storage.objects;
create policy "Chat images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-images');

drop policy if exists "Authenticated users can upload chat images" on storage.objects;
create policy "Authenticated users can upload chat images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');


-- ========== 20260512120000_chat_messages_product_id.sql ==========

-- Optional listing attachment per message (portrait card in UI). GreenHub `products.id` is bigint.

alter table public.chat_messages
  add column if not exists product_id bigint references public.products (id) on delete set null;

create index if not exists chat_messages_product_id_idx
  on public.chat_messages (product_id)
  where product_id is not null;

-- Recipients may still only change receipt columns; forbid mutating attachment fields on update.
create or replace function public.chat_messages_enforce_receipt_columns_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.sender_id is not distinct from auth.uid() then
    raise exception 'Only the recipient can update delivery receipts'
      using errcode = '42501';
  end if;

  if new.message is distinct from old.message
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
     or new.image_url is distinct from old.image_url
     or new.product_id is distinct from old.product_id
  then
    raise exception 'Recipients may only change status, delivered_at, read_at'
      using errcode = '42501';
  end if;

  return new;
end;
$$;


-- ========== 20260513120000_notifications_type_check.sql ==========

-- Issue 2: Allowed values for notifications.type (RLS policies reference these).

alter table public.notifications drop constraint if exists notification_type_check;

alter table public.notifications
  add constraint notification_type_check
  check (
    type in (
      'message',
      'product_like',
      'profile_follow',
      'product_sold',
      'boost_expiring',
      'comment',
      'reply'
    )
  );


-- ========== 20260514120000_chat_presence_typing_media_edit.sql ==========

-- Chat redesign: media_url + edited on chat_messages, typing_status, user_status, chat-media bucket,
-- sender message edit policy, and updated receipt/edit enforcement trigger.
-- Note: GreenHub uses public.chat_messages (not public.messages).

-- ---------------------------------------------------------------------------
-- chat_messages: voice/other media URL + edited flag
-- ---------------------------------------------------------------------------
alter table public.chat_messages
  add column if not exists media_url text,
  add column if not exists edited boolean not null default false;

comment on column public.chat_messages.media_url is 'Public URL for voice notes or other non-image media.';
comment on column public.chat_messages.edited is 'True after the sender edited message text.';

-- ---------------------------------------------------------------------------
-- Last preview + notifications: voice notes
-- ---------------------------------------------------------------------------
create or replace function public.touch_conversation_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    last_message = left(
      coalesce(
        nullif(trim(coalesce(new.message, '')), ''),
        case
          when new.image_url is not null and trim(coalesce(new.image_url, '')) <> '' then 'Photo'
          else null
        end,
        case
          when new.media_url is not null and trim(coalesce(new.media_url, '')) <> '' then 'Voice message'
          else null
        end,
        ''
      ),
      200
    ),
    last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

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
      nullif(trim(coalesce(new.message, '')), ''),
      case
        when new.image_url is not null and trim(coalesce(new.image_url, '')) <> '' then 'Photo'
        else null
      end,
      case
        when new.media_url is not null and trim(coalesce(new.media_url, '')) <> '' then 'Voice message'
        else null
      end,
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

-- ---------------------------------------------------------------------------
-- typing_status (one row per user per conversation)
-- ---------------------------------------------------------------------------
create table if not exists public.typing_status (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  is_typing boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint typing_status_conv_user_unique unique (conversation_id, user_id)
);

create index if not exists typing_status_conversation_id_idx on public.typing_status (conversation_id);

alter table public.typing_status enable row level security;

drop policy if exists "typing_status_select_participants" on public.typing_status;
create policy "typing_status_select_participants"
  on public.typing_status for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = typing_status.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

drop policy if exists "typing_status_insert_own" on public.typing_status;
create policy "typing_status_insert_own"
  on public.typing_status for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

drop policy if exists "typing_status_update_own" on public.typing_status;
create policy "typing_status_update_own"
  on public.typing_status for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = typing_status.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

drop policy if exists "typing_status_delete_own" on public.typing_status;
create policy "typing_status_delete_own"
  on public.typing_status for delete
  to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on table public.typing_status to authenticated;

-- ---------------------------------------------------------------------------
-- user_status (online / last seen)
-- ---------------------------------------------------------------------------
create table if not exists public.user_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_online boolean not null default false,
  last_seen timestamptz not null default now()
);

alter table public.user_status enable row level security;

drop policy if exists "user_status_select_authenticated" on public.user_status;
create policy "user_status_select_authenticated"
  on public.user_status for select
  to authenticated
  using (true);

drop policy if exists "user_status_insert_own" on public.user_status;
create policy "user_status_insert_own"
  on public.user_status for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_status_update_own" on public.user_status;
create policy "user_status_update_own"
  on public.user_status for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update on table public.user_status to authenticated;

-- ---------------------------------------------------------------------------
-- chat_messages: recipients vs sender updates (receipts vs edit own text)
-- ---------------------------------------------------------------------------
create or replace function public.chat_messages_enforce_receipt_columns_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Sender may only edit text + edited flag (no receipt or attachment changes).
  if old.sender_id is not distinct from auth.uid() then
    if new.conversation_id is distinct from old.conversation_id
       or new.sender_id is distinct from old.sender_id
       or new.created_at is distinct from old.created_at
       or new.reply_to_id is distinct from old.reply_to_id
       or new.image_url is distinct from old.image_url
       or new.media_url is distinct from old.media_url
       or new.product_id is distinct from old.product_id
       or new.status is distinct from old.status
       or new.delivered_at is distinct from old.delivered_at
       or new.read_at is distinct from old.read_at
    then
      raise exception 'You may only edit your message text'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Recipients may only update receipt columns.
  if new.message is distinct from old.message
     or new.edited is distinct from old.edited
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.reply_to_id is distinct from old.reply_to_id
     or new.image_url is distinct from old.image_url
     or new.media_url is distinct from old.media_url
     or new.product_id is distinct from old.product_id
  then
    raise exception 'Recipients may only change status, delivered_at, read_at'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop policy if exists "chat_messages_update_own_sender" on public.chat_messages;
create policy "chat_messages_update_own_sender"
  on public.chat_messages for update
  to authenticated
  using (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  )
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = chat_messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.seller_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: chat-media (images + voice)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do nothing;

drop policy if exists "Chat media public read" on storage.objects;
create policy "Chat media public read"
  on storage.objects for select
  using (bucket_id = 'chat-media');

drop policy if exists "Chat media authenticated upload" on storage.objects;
create policy "Chat media authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-media');

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.typing_status;
  exception
    when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.user_status;
  exception
    when duplicate_object then null;
  end;
end $$;


-- ========== 20260515120000_chat_message_reactions.sql ==========

-- Emoji reactions on chat messages (one reaction per user per message; upsert replaces).

create table if not exists public.chat_message_reactions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint chat_message_reactions_message_user_unique unique (message_id, user_id),
  constraint chat_message_reactions_emoji_len check (char_length(emoji) >= 1 and char_length(emoji) <= 32)
);

create index if not exists chat_message_reactions_conversation_id_idx
  on public.chat_message_reactions (conversation_id);

create index if not exists chat_message_reactions_message_id_idx
  on public.chat_message_reactions (message_id);

alter table public.chat_message_reactions enable row level security;

drop policy if exists "chat_message_reactions_select_participants" on public.chat_message_reactions;
create policy "chat_message_reactions_select_participants"
  on public.chat_message_reactions for select
  using (
    exists (
      select 1
      from public.conversations c
      where c.id = chat_message_reactions.conversation_id
        and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
    )
  );

drop policy if exists "chat_message_reactions_insert_participant" on public.chat_message_reactions;
create policy "chat_message_reactions_insert_participant"
  on public.chat_message_reactions for insert
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.conversations c
      where c.id = chat_message_reactions.conversation_id
        and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
    )
  );

drop policy if exists "chat_message_reactions_update_own" on public.chat_message_reactions;
create policy "chat_message_reactions_update_own"
  on public.chat_message_reactions for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "chat_message_reactions_delete_own" on public.chat_message_reactions;
create policy "chat_message_reactions_delete_own"
  on public.chat_message_reactions for delete
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on table public.chat_message_reactions to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.chat_message_reactions;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;


-- ========== 20260516120000_avatars_storage_bucket.sql ==========

-- Public avatars bucket: uploads must live under `{auth.uid()}/filename`
-- Standalone copy for manual runs: supabase/sql/avatars_storage_bucket.sql

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_insert_own_folder" on storage.objects;
create policy "avatars_authenticated_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

drop policy if exists "avatars_authenticated_update_own" on storage.objects;
create policy "avatars_authenticated_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );

drop policy if exists "avatars_authenticated_delete_own" on storage.objects;
create policy "avatars_authenticated_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid()::text)
  );


-- ========== 20260516130000_mark_all_notifications_read.sql ==========

-- Mark all in-app notifications read for the current user (bypasses RLS safely via auth.uid()).

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;
end;
$$;

comment on function public.mark_all_notifications_read() is
  'Sets read_at on all unread notifications for auth.uid(). Used by the app bell / notifications panel.';

grant execute on function public.mark_all_notifications_read() to authenticated;


-- ========== 20260517120000_products_international_shipping.sql ==========

-- International shipping destinations (preset ids, e.g. usa, uk) and per-destination fee + ETA JSON.
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_destinations TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS international_shipping_fees JSONB;

COMMENT ON COLUMN products.shipping_destinations IS 'Selected international shipping preset ids (e.g. usa, uk, canada).';
COMMENT ON COLUMN products.international_shipping_fees IS 'Per preset: { "usa": { "fee": number, "duration": "7-14 days" }, ... }.';


-- ========== 20260518120000_profiles_verified_advertiser.sql ==========

-- Paid boost / ads â†’ "Verified Advertiser" on profiles (driven by successful boost_transactions).

alter table public.profiles
  add column if not exists is_verified_advertiser boolean not null default false;

comment on column public.profiles.is_verified_advertiser is
  'True once the user has at least one successful boost_transactions row (paid ads).';

-- Recreate public profile view to expose the flag for listings / cards.
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
  case when coalesce(p.show_email_on_profile, false) then p.email else null end as public_email,
  coalesce(p.is_verified_advertiser, false) as is_verified_advertiser
from public.profiles p;

comment on view public.profiles_public is
  'Directory-safe fields; phone/public_email only when user enabled visibility; is_verified_advertiser for paid boost trust.';

revoke all on table public.profiles_public from public;
grant select on table public.profiles_public to anon, authenticated;

-- Backfill from existing successful boost payments
update public.profiles p
set is_verified_advertiser = true
where exists (
  select 1
  from public.boost_transactions b
  where b.seller_id = p.id
    and b.status = 'success'
);

-- Keep flag in sync on insert / when status becomes success
create or replace function public.sync_verified_advertiser_from_boost()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'success' and new.seller_id is not null then
    update public.profiles
    set is_verified_advertiser = true
    where id = new.seller_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_sync_verified_advertiser on public.boost_transactions;
create trigger trigger_sync_verified_advertiser
  after insert or update of status, seller_id on public.boost_transactions
  for each row
  execute function public.sync_verified_advertiser_from_boost();

