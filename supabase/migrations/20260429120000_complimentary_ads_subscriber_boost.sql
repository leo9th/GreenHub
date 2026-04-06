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
