-- Buyer/seller/rider/admin can read assigned courier presence for an order via RPC only (no broad rider_presence exposure).

create or replace function public.get_order_assigned_rider_presence(p_order_id uuid)
returns table (
  rider_user_id uuid,
  latitude double precision,
  longitude double precision,
  last_seen_at timestamptz,
  is_online boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_assigned uuid;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select dj.assigned_rider_id
  into v_assigned
  from public.delivery_jobs dj
  where dj.order_id = p_order_id
  limit 1;

  if v_assigned is null then
    return;
  end if;

  select
    public.fn_is_admin_user()
    or exists (
      select 1
      from public.orders o
      where o.id = p_order_id
        and o.buyer_id = v_uid
    )
    or exists (
      select 1
      from public.order_items oi
      where oi.order_id = p_order_id
        and oi.seller_id = v_uid
    )
    or v_assigned = v_uid
  into v_allowed;

  if not coalesce(v_allowed, false) then
    return;
  end if;

  return query
  select
    rp.rider_user_id,
    rp.latitude,
    rp.longitude,
    rp.last_seen_at,
    rp.is_online
  from public.rider_presence rp
  where rp.rider_user_id = v_assigned;
end;
$$;

revoke all on function public.get_order_assigned_rider_presence(uuid) from public;
grant execute on function public.get_order_assigned_rider_presence(uuid) to authenticated;
