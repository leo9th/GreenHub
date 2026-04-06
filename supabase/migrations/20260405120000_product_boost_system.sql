-- GreenHub: per-listing paid boosts (Paystack) + listing sort + admin/seller visibility

-- ---------------------------------------------------------------------------
-- Products: boost fields
-- ---------------------------------------------------------------------------
alter table public.products
  add column if not exists boost_expires_at timestamptz,
  add column if not exists boost_tier text,
  add column if not exists boost_count integer not null default 0,
  add column if not exists priority_score integer not null default 0;

comment on column public.products.boost_expires_at is 'When the paid boost ends; null if never boosted or fully expired.';
comment on column public.products.boost_tier is 'daily | weekly | monthly | yearly — last purchased tier while active.';
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
        or length(v_search) < 2
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
