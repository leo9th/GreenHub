-- Align rider_presence with RPCs + app: rider_user_id (auth.users) is source of truth.
-- Safe when rider_presence came only from 20260702170000 (no rider_id column yet).

create or replace function public.fn_is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'admin'
  );
$$;

revoke all on function public.fn_is_admin_user() from public;
grant execute on function public.fn_is_admin_user() to authenticated;

alter table public.rider_presence
  add column if not exists rider_user_id uuid null references auth.users (id) on delete cascade;

alter table public.rider_presence
  add column if not exists updated_at timestamptz not null default now();

-- Older deployments may not have run 20260704100000; ensure rider_id exists before updates.
alter table public.rider_presence
  add column if not exists rider_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rider_presence_rider_id_fkey'
      and conrelid = 'public.rider_presence'::regclass
  ) then
    begin
      alter table public.rider_presence
        add constraint rider_presence_rider_id_fkey
        foreign key (rider_id) references public.riders(id) on delete set null;
    exception
      when foreign_key_violation then
        null;
    end;
  end if;
end
$$;

-- Backfill rider_user_id from riders when we only have rider_id.
update public.rider_presence rp
set rider_user_id = r.user_id
from public.riders r
where rp.rider_id = r.id
  and rp.rider_user_id is null;

-- Backfill rider_id when we only have rider_user_id (older RPC rows).
update public.rider_presence rp
set rider_id = r.id
from public.riders r
where r.user_id = rp.rider_user_id
  and rp.rider_id is null;

create index if not exists idx_rider_presence_rider_user_id
  on public.rider_presence (rider_user_id);

create index if not exists idx_rider_presence_rider_id
  on public.rider_presence (rider_id);

-- RLS: own row by auth user id OR by riders.id link OR admin.
drop policy if exists rider_presence_upsert_own on public.rider_presence;
drop policy if exists rider_presence_update_own on public.rider_presence;

drop policy if exists rider_presence_select_own_or_admin on public.rider_presence;
create policy rider_presence_select_own_or_admin
on public.rider_presence
for select
to authenticated
using (
  public.fn_is_admin_user()
  or rider_user_id = auth.uid()
  or exists (
    select 1
    from public.riders r
    where r.id = rider_presence.rider_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists rider_presence_insert_own on public.rider_presence;
create policy rider_presence_insert_own
on public.rider_presence
for insert
to authenticated
with check (
  rider_user_id = auth.uid()
  or exists (
    select 1
    from public.riders r
    where r.id = rider_presence.rider_id
      and r.user_id = auth.uid()
  )
);

drop policy if exists rider_presence_update_own_or_admin on public.rider_presence;
create policy rider_presence_update_own_or_admin
on public.rider_presence
for update
to authenticated
using (
  public.fn_is_admin_user()
  or rider_user_id = auth.uid()
  or exists (
    select 1
    from public.riders r
    where r.id = rider_presence.rider_id
      and r.user_id = auth.uid()
  )
)
with check (
  public.fn_is_admin_user()
  or rider_user_id = auth.uid()
  or exists (
    select 1
    from public.riders r
    where r.id = rider_presence.rider_id
      and r.user_id = auth.uid()
  )
);

grant select, insert, update on public.rider_presence to authenticated;
