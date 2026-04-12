-- User-to-user reports (scam, harassment, etc.)

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint user_reports_no_self check (reporter_id <> reported_user_id)
);

create index if not exists user_reports_reported_idx on public.user_reports (reported_user_id);
create index if not exists user_reports_reporter_idx on public.user_reports (reporter_id);
create index if not exists user_reports_created_idx on public.user_reports (created_at desc);

alter table public.user_reports enable row level security;

drop policy if exists "user_reports_insert_own" on public.user_reports;
drop policy if exists "user_reports_select_own" on public.user_reports;

create policy "user_reports_insert_own"
  on public.user_reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "user_reports_select_own"
  on public.user_reports for select
  to authenticated
  using (reporter_id = auth.uid());

notify pgrst, 'reload schema';
