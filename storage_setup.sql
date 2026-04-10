-- GreenHub Storage Setup Script
-- Create buckets for avatars and products
insert into storage.buckets (id, name, public)
values 
  ('avatars', 'avatars', true),
  ('products', 'products', true),
  ('chat-images', 'chat-images', true),
  ('chat-attachments', 'chat-attachments', true),
  ('job-application-uploads', 'job-application-uploads', false)
on conflict on constraint buckets_pkey do nothing;

-- Set up security policies for Avatars
-- Allow public viewing
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

-- Allow authenticated users to upload
create policy "Anyone can upload an avatar."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Allow users to update their own avatars
create policy "Users can update their own avatars."
  on storage.objects for update
  using ( bucket_id = 'avatars' AND auth.uid() = owner );

-- Allow users to delete their own avatars
create policy "Users can delete their own avatars."
  on storage.objects for delete
  using ( bucket_id = 'avatars' AND auth.uid() = owner );

-- Set up security policies for Products
-- Allow public viewing
create policy "Product images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'products' );

-- Allow authenticated users to upload product images
create policy "Authenticated users can upload product images."
  on storage.objects for insert
  with check ( bucket_id = 'products' AND auth.role() = 'authenticated' );

-- Allow sellers to update their own product images
create policy "Sellers can update own product images."
  on storage.objects for update
  using ( bucket_id = 'products' AND auth.uid() = owner );

-- Allow sellers to delete their own product images
create policy "Sellers can delete own product images."
  on storage.objects for delete
  using ( bucket_id = 'products' AND auth.uid() = owner );

-- Chat images (DM attachments) — public read; authenticated upload
drop policy if exists "Chat images are publicly readable" on storage.objects;
create policy "Chat images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-images');

drop policy if exists "Authenticated users can upload chat images" on storage.objects;
create policy "Authenticated users can upload chat images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-images');

-- Chat attachments (DM: images, PDF, Word) — public read; authenticated upload
drop policy if exists "Chat attachments are publicly readable" on storage.objects;
create policy "Chat attachments are publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-attachments');

drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload chat attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-attachments');

-- Job application uploads (/apply) — private bucket; anon + authenticated may upload only
drop policy if exists "Job application files upload." on storage.objects;
create policy "Job application files upload."
  on storage.objects for insert
  to anon, authenticated
  with check ( bucket_id = 'job-application-uploads' );
