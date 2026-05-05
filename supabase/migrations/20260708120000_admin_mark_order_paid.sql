-- Admin-only: mark eligible orders paid so existing orders.status triggers create delivery_jobs.

begin;

create or replace function public.admin_mark_order_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ord record;
  v_st text;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not public.fn_greenhub_is_admin(v_uid) then
    raise exception 'Admin only';
  end if;

  select o.id, o.status
  into v_ord
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  v_st := lower(trim(coalesce(v_ord.status, '')));

  if v_st = 'paid' then
    return;
  end if;

  if v_st in ('delivered', 'completed', 'cancelled', 'refunded', 'failed') then
    raise exception 'Cannot mark paid from terminal status: %', v_st;
  end if;

  if v_st not in ('pending_payment', 'needs_review', 'pending', 'processing') then
    raise exception 'Admin cannot mark paid from status: %', v_st;
  end if;

  update public.orders o
  set status = 'paid'
  where o.id = p_order_id;

  insert into public.order_events (order_id, event_label, metadata)
  values (
    p_order_id,
    'admin_marked_paid',
    jsonb_build_object(
      'previous_status', v_st,
      'actor_id', v_uid,
      'marked_at', now()
    )
  );
end;
$$;

revoke all on function public.admin_mark_order_paid(uuid) from public;
grant execute on function public.admin_mark_order_paid(uuid) to authenticated;

commit;
