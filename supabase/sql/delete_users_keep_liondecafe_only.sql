-- =====================================================================
-- DANGER: Destroys almost all Auth users and related public data.
-- Keeps ONLY auth.users row where email = liondecafe@gmail.com (case-insensitive).
--
-- Run in Supabase SQL Editor as postgres (or service role). NOT applied by migrations.
-- Take a backup first. If any step errors, read the message and adjust (e.g. extra tables).
--
-- Recommended order:
--   1) Confirm keeper account exists (Dashboard → Authentication → Users).
--   2) Run this script in a transaction; COMMIT only if everything succeeded.
-- =====================================================================

begin;

do $$
declare
  keep_id uuid;
begin
  select id into keep_id
  from auth.users
  where lower(trim(coalesce(email, ''))) = 'liondecafe@gmail.com'
  limit 1;

  if keep_id is null then
    raise exception 'Keeper not found: create/sign up liondecafe@gmail.com before running this script.';
  end if;

  -- Public rows keyed by user id (safe if FK is CASCADE from auth delete; extra deletes help older schemas)
  delete from public.profiles where id <> keep_id;

  -- Listings owned by deleted sellers (adjust if your products FK has no CASCADE)
  delete from public.products where seller_id is distinct from keep_id;

  -- Auth children (names vary slightly by Supabase version; comment out lines that error)
  delete from auth.identities where user_id is distinct from keep_id;

  -- Sessions (optional; comment out if your project has no auth.sessions.user_id)
  delete from auth.sessions where user_id is distinct from keep_id;

  delete from auth.users where id is distinct from keep_id;
end $$;

commit;

-- After this: sign in again as liondecafe@gmail.com; other emails can register fresh.
