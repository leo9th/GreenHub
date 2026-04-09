-- Ensure string-like columns on public.profiles are type `text`.
-- Fixes misconfigured schemas where e.g. avatar_url was created as smallint, which breaks
-- Google OAuth inserts (picture URL) from ensureOAuthProfile.

do $$
declare
  col text;
  typ text;
  cols constant text[] := array[
    'full_name',
    'avatar_url',
    'phone',
    'gender',
    'state',
    'lga',
    'address',
    'email',
    'auto_reply',
    'bio'
  ];
begin
  foreach col in array cols
  loop
    select c.data_type
    into typ
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'profiles'
      and c.column_name = col;

    if typ is null then
      execute format('alter table public.profiles add column %I text', col);
    elsif typ <> 'text' then
      execute format(
        'alter table public.profiles alter column %I type text using %I::text',
        col,
        col
      );
    end if;
  end loop;
end
$$;
