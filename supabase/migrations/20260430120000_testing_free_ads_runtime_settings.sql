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
