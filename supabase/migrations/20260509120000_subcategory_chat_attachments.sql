-- Electronics subcategory + chat-attachments storage bucket (file uploads in chat)

alter table public.products add column if not exists subcategory text;

comment on column public.products.subcategory is
  'When category is electronics, seller sub-type (Laptops, Phones & Tablets, etc.) or custom text for Other.';

-- Public bucket for chat file URLs embedded in messages / image_url
insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Chat attachments are publicly readable" on storage.objects;
create policy "Chat attachments are publicly readable"
  on storage.objects for select
  using (bucket_id = 'chat-attachments');

drop policy if exists "Authenticated users can upload chat attachments" on storage.objects;
create policy "Authenticated users can upload chat attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'chat-attachments');

-- Listing RPC: filter by subcategory when category is electronics
drop function if exists public.rpc_products_listing(
  text, text, text, text, text, numeric, numeric, text, int, int
);

create or replace function public.rpc_products_listing(
  p_search text default null,
  p_category text default null,
  p_condition text default null,
  p_car_brand text default null,
  p_subcategory text default null,
  p_state text default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_sort text default 'recent',
  p_limit int default 12,
  p_offset int default 0
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total bigint;
  v_rows json;
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_cat text := nullif(trim(coalesce(p_category, '')), '');
  v_cond text := nullif(trim(coalesce(p_condition, '')), '');
  v_brand text := nullif(trim(coalesce(p_car_brand, '')), '');
  v_sub text := nullif(trim(coalesce(p_subcategory, '')), '');
  v_state text := nullif(trim(coalesce(p_state, '')), '');
  v_sort text := coalesce(nullif(trim(coalesce(p_sort, '')), ''), 'recent');
begin
  if v_cat in ('all', '') then v_cat := null; end if;
  if v_cond in ('all', '') then v_cond := null; end if;
  if v_brand in ('all', '') then v_brand := null; end if;
  if v_sub in ('all', '') then v_sub := null; end if;
  if v_state in ('all', '') then v_state := null; end if;

  with filtered as (
    select p.*
    from public.products p
    where p.status = 'active'
      and (
        v_search is null
        or p.title ilike '%' || v_search || '%'
      )
      and (v_cat is null or p.category = v_cat)
      and (v_cond is null or p.condition = v_cond)
      and (
        v_brand is null
        or coalesce(v_cat, '') <> 'vehicles'
        or p.car_brand = v_brand
      )
      and (
        v_sub is null
        or coalesce(v_cat, '') <> 'electronics'
        or p.subcategory = v_sub
      )
      and (
        v_state is null
        or p.location ilike '%' || v_state || '%'
      )
      and (p_price_min is null or coalesce(p.price_local, p.price, 0) >= p_price_min)
      and (p_price_max is null or coalesce(p.price_local, p.price, 0) <= p_price_max)
  ),
  counted as (
    select count(*)::bigint as cnt from filtered
  ),
  ordered as (
    select f.*
    from filtered f
    order by
      case
        when f.boost_expires_at is not null and f.boost_expires_at > now() then 0
        else 1
      end,
      coalesce(f.priority_score, 0) desc,
      case when v_sort = 'price-low' then coalesce(f.price_local, f.price, 0) end asc nulls last,
      case when v_sort = 'price-high' then coalesce(f.price_local, f.price, 0) end desc nulls last,
      case
        when v_sort = 'rating'
        then coalesce(f.average_rating, f.rating::numeric, 0)
      end desc nulls last,
      f.created_at desc nulls last
    limit greatest(coalesce(p_limit, 12), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  )
  select
    (select c.cnt from counted c),
    coalesce((select json_agg(to_jsonb(o)) from ordered o), '[]'::json)
  into v_total, v_rows;

  return json_build_object('total', coalesce(v_total, 0), 'rows', v_rows);
end;
$$;

grant execute on function public.rpc_products_listing(
  text, text, text, text, text, text, numeric, numeric, text, int, int
) to anon, authenticated;
