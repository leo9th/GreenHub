-- Job applications: ID verification fields, encrypted ID number, admin policies, storage read for admins

-- Extend profiles for admin UI (set manually: update profiles set is_admin = true where id = 'your-uuid';)
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- New application columns (paths = Supabase Storage object keys in job-application-uploads bucket)
alter table public.job_applications
  add column if not exists id_front_image text,
  add column if not exists id_back_image text,
  add column if not exists selfie_image text,
  add column if not exists id_verified boolean not null default false,
  add column if not exists id_verification_status text not null default 'pending'
    check (id_verification_status in ('pending', 'approved', 'rejected')),
  add column if not exists verification_notes text,
  add column if not exists id_number_ciphertext text,
  add column if not exists id_number_iv text,
  add column if not exists client_auto_verification_passed boolean not null default false;

comment on column public.job_applications.id_front_image is 'Storage path for ID front image';
comment on column public.job_applications.id_back_image is 'Storage path for ID back image';
comment on column public.job_applications.selfie_image is 'Storage path for applicant selfie';
comment on column public.job_applications.id_number_ciphertext is 'AES-GCM ciphertext (base64) for ID number; decrypt with app key server-side or admin UI';

-- Legacy plaintext id_number: allow null for new encrypted-only rows
alter table public.job_applications alter column id_number drop not null;

-- Admin: read / update applications
drop policy if exists "job_applications_admin_select" on public.job_applications;
create policy "job_applications_admin_select"
  on public.job_applications
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

drop policy if exists "job_applications_admin_update" on public.job_applications;
create policy "job_applications_admin_update"
  on public.job_applications
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );

-- Admins can generate signed URLs for private job uploads
drop policy if exists "job_application_uploads_admin_select" on storage.objects;
create policy "job_application_uploads_admin_select"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'job-application-uploads'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and coalesce(p.is_admin, false) = true
    )
  );
