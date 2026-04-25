do $$
declare
  v_status_udt text;
  v_con record;
begin
  select c.udt_name
  into v_status_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and c.column_name = 'status';

  if v_status_udt is null then
    raise exception 'orders.status column not found';
  end if;

  -- Enum-backed status column support.
  if exists (
    select 1
    from pg_type t
    where t.typname = v_status_udt
      and t.typtype = 'e'
  ) then
    execute format('alter type %I add value if not exists %L', v_status_udt, 'needs_review');
    return;
  end if;

  -- Text-backed status column support with check constraints.
  for v_con in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint if exists %I', v_con.conname);
  end loop;

  alter table public.orders
    add constraint orders_status_check
    check (
      status in (
        'pending',
        'awaiting_payment',
        'created',
        'pending_payment',
        'pod_confirmed',
        'processing',
        'paid',
        'confirmed',
        'shipped',
        'in_transit',
        'delivered',
        'completed',
        'cancelled',
        'needs_review'
      )
    );
end $$;

notify pgrst, 'reload schema';
