-- GreenHub uses delivery_jobs only for new paid orders. Legacy delivery_requests + trg_orders_delivery_request
-- stay in the schema for historical rows and diagnostics; this migration stops NEW rows from being created on paid.

begin;

drop trigger if exists trg_orders_delivery_request on public.orders;

-- Rider declines an admin-offered GreenHub job before accepting (mirrors legacy rider_decline_delivery_request).
create or replace function public.rider_decline_delivery_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.delivery_jobs%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select * into v_job from public.delivery_jobs dj where dj.id = p_job_id for update;
  if not found then
    raise exception 'Delivery job not found';
  end if;

  if v_job.assigned_rider_id is distinct from v_uid then
    raise exception 'Only the assigned rider can decline this job';
  end if;

  if lower(coalesce(v_job.status, '')) is distinct from 'assigned' then
    raise exception 'Invalid transition: only jobs awaiting rider acceptance can be declined';
  end if;

  update public.delivery_assignments da
  set status = 'rejected', responded_at = now()
  where da.job_id = p_job_id
    and da.rider_user_id = v_uid
    and da.status = 'offered';

  update public.delivery_jobs dj
  set status = 'pending_dispatch',
      assigned_rider_id = null
  where dj.id = p_job_id;

  perform public._greenhub_append_delivery_event(
    p_job_id,
    'rider_declined',
    jsonb_build_object('rider_user_id', v_uid),
    v_uid
  );
end;
$$;

revoke all on function public.rider_decline_delivery_job(uuid) from public;
grant execute on function public.rider_decline_delivery_job(uuid) to authenticated;

commit;
