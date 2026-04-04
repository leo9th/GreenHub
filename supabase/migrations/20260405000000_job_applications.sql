-- Job seeker applications (separate from marketplace accounts)
-- Run in Supabase SQL editor or via CLI. Configure storage file size limits in Dashboard if needed.

-- Table ---------------------------------------------------------------------
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  full_name text not null,
  phone text not null,
  email text not null,
  date_of_birth date not null,
  gender text not null check (gender in ('Male', 'Female', 'Prefer not to say')),

  id_type text not null,
  id_number text not null,
  id_document_storage_path text,

  education_level text not null,
  years_experience numeric(6, 1) not null,
  skills text not null,
  previous_job_title text not null,
  previous_company text,
  cv_storage_path text,
  portfolio_url text,

  desired_job_category text not null,
  desired_location text not null,
  expected_salary_range text not null,
  available_start_date date not null,

  bio text not null,
  why_greenhub text not null,

  confirms_accurate boolean not null,
  agrees_terms boolean not null,

  constraint job_applications_agreements check (confirms_accurate is true and agrees_terms is true)
);

comment on table public.job_applications is 'GreenHub / partner employment interest submissions; not linked to seller profiles.';

alter table public.job_applications enable row level security;

drop policy if exists "job_applications_anon_insert" on public.job_applications;
-- Public can submit applications only (no read/update/delete for anon)
create policy "job_applications_anon_insert"
  on public.job_applications
  for insert
  to anon, authenticated
  with check (true);

-- Storage: private bucket for ID scans and CVs --------------------------------
insert into storage.buckets (id, name, public)
  values ('job-application-uploads', 'job-application-uploads', false)
on conflict (id) do nothing;

drop policy if exists "job_application_uploads_insert" on storage.objects;
-- Allow uploads into this bucket (adjust to authenticated-only if you require login later)
create policy "job_application_uploads_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'job-application-uploads');

-- Optional: allow users to read only their own folder (not used by current flow).
-- Admins should use service role or Dashboard to review files.
