-- Repair older/misconfigured profiles schemas where text-like fields were created
-- with the wrong type (for example, avatar_url as smallint).

do $$
begin
  -- Ensure commonly used profile columns exist with the expected shape.
  alter table public.profiles add column if not exists full_name text;
  alter table public.profiles add column if not exists avatar_url text;
  alter table public.profiles add column if not exists phone text;
  alter table public.profiles add column if not exists gender text;
  alter table public.profiles add column if not exists state text;
  alter table public.profiles add column if not exists lga text;
  alter table public.profiles add column if not exists address text;
  alter table public.profiles add column if not exists email text;
  alter table public.profiles add column if not exists auto_reply text;
  alter table public.profiles add column if not exists bio text;
  alter table public.profiles add column if not exists updated_at timestamptz;

  -- Coerce text-like columns to text when an older schema used the wrong type.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column full_name type text using full_name::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_url'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column avatar_url type text using avatar_url::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'phone'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column phone type text using phone::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'gender'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column gender type text using gender::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'state'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column state type text using state::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'lga'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column lga type text using lga::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'address'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column address type text using address::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column email type text using email::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'auto_reply'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column auto_reply type text using auto_reply::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'bio'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column bio type text using bio::text;
  end if;
end
$$;
-- Repair older/misconfigured profiles schemas where text-like fields were created
-- with the wrong type (for example, avatar_url as smallint).

do $$
begin
  -- Ensure commonly used profile columns exist with the expected shape.
  alter table public.profiles add column if not exists full_name text;
  alter table public.profiles add column if not exists avatar_url text;
  alter table public.profiles add column if not exists phone text;
  alter table public.profiles add column if not exists gender text;
  alter table public.profiles add column if not exists state text;
  alter table public.profiles add column if not exists lga text;
  alter table public.profiles add column if not exists address text;
  alter table public.profiles add column if not exists email text;
  alter table public.profiles add column if not exists auto_reply text;
  alter table public.profiles add column if not exists bio text;
  alter table public.profiles add column if not exists updated_at timestamptz;

  -- Coerce text-like columns to text when an older schema used the wrong type.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'full_name'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column full_name type text using full_name::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_url'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column avatar_url type text using avatar_url::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'phone'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column phone type text using phone::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'gender'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column gender type text using gender::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'state'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column state type text using state::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'lga'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column lga type text using lga::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'address'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column address type text using address::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column email type text using email::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'auto_reply'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column auto_reply type text using auto_reply::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'bio'
      and data_type <> 'text'
  ) then
    alter table public.profiles alter column bio type text using bio::text;
  end if;
end
$$;
