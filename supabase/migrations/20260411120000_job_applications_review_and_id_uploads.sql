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
