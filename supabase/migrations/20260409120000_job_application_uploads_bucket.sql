-- Storage for GreenHub employment form (/apply): ID document + CV uploads.
-- Without this bucket, submit returns "Bucket not found".

insert into storage.buckets (id, name, public)
values ('job-application-uploads', 'job-application-uploads', false)
on conflict (id) do nothing;

-- Applicants may submit without signing in (anon); signed-in users also allowed.
drop policy if exists job_application_uploads_insert_public on storage.objects;
create policy job_application_uploads_insert_public on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'job-application-uploads');
