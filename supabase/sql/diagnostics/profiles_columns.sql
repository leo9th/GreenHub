-- Run in Supabase SQL Editor (or psql) to inspect public.profiles column types.
-- Helps catch wrong types (e.g. avatar_url as smallint) before/after repair migrations.

SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;
