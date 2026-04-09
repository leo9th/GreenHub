-- Like system hardening: permissions, count backfill, and realtime publication.

alter table public.product_likes enable row level security;

grant select on table public.product_likes to anon, authenticated;
grant insert, delete on table public.product_likes to authenticated;

-- Backfill like_count to avoid drift from historical/manual writes.
with like_totals as (
  select product_id, count(*)::integer as cnt
  from public.product_likes
  group by product_id
)
update public.products p
set like_count = lt.cnt
from like_totals lt
where p.id = lt.product_id
  and coalesce(p.like_count, 0) <> lt.cnt;

update public.products p
set like_count = 0
where coalesce(p.like_count, 0) <> 0
  and not exists (
    select 1
    from public.product_likes pl
    where pl.product_id = p.id
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.products;
    exception
      when duplicate_object then null;
    end;
  end if;
end
$$;
