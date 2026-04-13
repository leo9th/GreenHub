-- GreenHub member id (GH-XXXX-XXXX-XX) + optional trust metrics

alter table public.profiles add column if not exists unique_id text;
alter table public.profiles add column if not exists trust_score integer not null default 0;
alter table public.profiles add column if not exists verified_badge boolean not null default false;
alter table public.profiles add column if not exists total_transactions integer not null default 0;
alter table public.profiles add column if not exists total_spent numeric(12, 2) not null default 0;

create unique index if not exists profiles_unique_id_uq on public.profiles (unique_id) where unique_id is not null;

create or replace function public.profiles_generate_unique_id()
returns text
language sql
stable
as $$
  select 'GH-' ||
    upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 4)) || '-' ||
    upper(substring(md5(random()::text || clock_timestamp()::text) from 5 for 4)) || '-' ||
    upper(substring(md5(random()::text || clock_timestamp()::text) from 9 for 2));
$$;

create or replace function public.profiles_set_unique_id()
returns trigger
language plpgsql
as $$
declare
  attempt int := 0;
  candidate text;
begin
  if new.unique_id is not null and btrim(new.unique_id) <> '' then
    return new;
  end if;
  loop
    candidate := public.profiles_generate_unique_id();
    attempt := attempt + 1;
    exit when not exists (select 1 from public.profiles p where p.unique_id = candidate);
    exit when attempt > 12;
  end loop;
  new.unique_id := candidate;
  return new;
end;
$$;

drop trigger if exists profiles_set_unique_id_trg on public.profiles;
create trigger profiles_set_unique_id_trg
  before insert on public.profiles
  for each row
  execute function public.profiles_set_unique_id();

do $$
declare
  r record;
  cand text;
  tries int;
begin
  for r in select id from public.profiles where unique_id is null or btrim(unique_id) = '' loop
    tries := 0;
    loop
      cand := public.profiles_generate_unique_id();
      tries := tries + 1;
      exit when not exists (select 1 from public.profiles p2 where p2.unique_id = cand);
      exit when tries > 25;
    end loop;
    update public.profiles set unique_id = cand where id = r.id;
  end loop;
end
$$;

notify pgrst, 'reload schema';
