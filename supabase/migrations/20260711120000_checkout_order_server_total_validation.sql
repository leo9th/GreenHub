-- Checkout Phase 2: recompute subtotal/platform/delivery from trusted DB product prices
-- and validate client-declared totals before inserting orders and order_items.
--
-- Delivery fee rules (aligned with src/app/utils/fulfillment.ts):
-- - If any line resolves to warehouse_shipping: add flat 2000 NGN once; per-line delivery snapshot 0 for those lines.
-- - Otherwise sum one marketplace fee per non-warehouse line.
-- - Trusted fee from products.delivery_options when column is json/jsonb (first array element fee) or text[] (_text)
--   with first element parseable as JSON object (fee). Otherwise falls back to client deliveryFee for that line.
-- - products.fulfillment_type (when present) overrides client fulfillment for warehouse vs marketplace split.

create or replace function public.create_checkout_order(
  p_shipping_address jsonb,
  p_items jsonb,
  p_total_amount numeric,
  p_delivery_fee numeric,
  p_platform_fee numeric,
  p_order_status text,
  p_payment_reference text,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer_id uuid := auth.uid();
  v_order_id uuid;
  v_item jsonb;
  v_item_id text;
  v_title text;
  v_image text;
  v_quantity integer;
  v_unit_price numeric(12, 2);
  v_delivery_fee_at_time numeric(12, 2);
  v_fulfillment_type text;
  v_seller_id uuid;
  v_stock_quantity integer;
  v_products_id_type text;
  v_order_items_product_id_type text;
  v_notified_sellers uuid[] := '{}'::uuid[];
  v_orders_amount_column text;
  v_has_price_local boolean;
  v_has_fulfillment_col boolean;
  v_has_delivery_options boolean;
  v_delivery_opts_dtype text;
  v_delivery_opts_udt text;
  v_has_image_col boolean;
  v_has_images_col boolean;
  v_price_sql text;
  v_image_sql text;
  v_ft_sql text;
  v_db_ft text;
  v_do_text text[];
  v_do_json jsonb;
  v_db_image text;
  v_client_fee numeric(12, 2);
  v_client_ft text;
  v_first_opt text;
  v_fee_from_opts numeric(12, 2);
  v_tol constant numeric := 0.02;
  v_guaranteed_flat constant numeric := 2000;
  v_subtotal numeric(14, 2) := 0;
  v_market_delivery_sum numeric(14, 2) := 0;
  v_has_warehouse boolean := false;
  v_expected_delivery numeric(14, 2);
  v_expected_platform numeric(14, 2);
  v_expected_total numeric(14, 2);
  v_line jsonb;
  v_specs jsonb := '[]'::jsonb;
  v_qty_raw text;
  v_qty_num numeric;
begin
  if v_buyer_id is null then
    raise exception 'Authentication required to create an order.';
  end if;

  if p_order_status not in ('paid', 'pending_payment', 'needs_review') then
    raise exception 'Unsupported checkout order status: %', p_order_status;
  end if;

  if p_payment_method not in ('paystack', 'pod') then
    raise exception 'Unsupported checkout payment method: %', p_payment_method;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Checkout requires at least one cart item.';
  end if;

  select c.data_type
  into v_products_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'products'
    and c.column_name = 'id';

  select c.data_type
  into v_order_items_product_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'order_items'
    and c.column_name = 'product_id';

  if v_products_id_type is null or v_order_items_product_id_type is null then
    raise exception 'Checkout schema is missing a required product id column definition.';
  end if;

  select c.column_name
  into v_orders_amount_column
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'orders'
    and c.column_name in ('total_amount', 'total_price', 'amount')
  order by case c.column_name
    when 'total_amount' then 1
    when 'total_price' then 2
    when 'amount' then 3
    else 4
  end
  limit 1;

  if v_orders_amount_column is null then
    raise exception 'orders table is missing total column (expected one of total_amount, total_price, amount).';
  end if;

  select exists(
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'products' and c.column_name = 'price_local'
  ) into v_has_price_local;

  select exists(
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'products' and c.column_name = 'fulfillment_type'
  ) into v_has_fulfillment_col;

  select exists(
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'products' and c.column_name = 'delivery_options'
  ) into v_has_delivery_options;

  if v_has_delivery_options then
    select c.data_type, c.udt_name
    into v_delivery_opts_dtype, v_delivery_opts_udt
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'products' and c.column_name = 'delivery_options';
  end if;

  select exists(
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'products' and c.column_name = 'image'
  ) into v_has_image_col;

  select exists(
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'products' and c.column_name = 'images'
  ) into v_has_images_col;

  v_price_sql := case
    when v_has_price_local then 'coalesce(price_local, price, 0)::numeric(12,2)'
    else 'coalesce(price, 0)::numeric(12,2)'
  end;

  v_image_sql := case
    when v_has_image_col and v_has_images_col then
      E'coalesce(nullif(trim(image), ''''), nullif(trim((coalesce(images, ''{}''::text[]))[1]), ''''))'
    when v_has_image_col then
      E'nullif(trim(image), '''')'
    when v_has_images_col then
      E'nullif(trim((coalesce(images, ''{}''::text[]))[1]), '''')'
    else
      'null::text'
  end;

  v_ft_sql := case
    when v_has_fulfillment_col then 'fulfillment_type'
    else 'null::text'
  end;

  if v_has_delivery_options and v_delivery_opts_dtype in ('jsonb', 'json') then
    v_do_sql := 'delivery_options::jsonb';
  elsif v_has_delivery_options and v_delivery_opts_dtype = 'ARRAY' then
    v_do_sql := 'delivery_options';
  elsif v_has_delivery_options then
    v_do_sql := 'delivery_options::text';
  else
    v_do_sql := 'null::text[]';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    v_item_id := nullif(trim(v_item->>'id'), '');
    if v_item_id is null then
      raise exception 'Cart item is missing a product id.';
    end if;

    v_qty_raw := v_item->>'quantity';
    if v_qty_raw is null or btrim(v_qty_raw) = '' then
      raise exception 'Each cart item requires a positive integer quantity.';
    end if;
    begin
      v_qty_num := v_qty_raw::numeric;
    exception
      when others then
        raise exception 'Each cart item requires a positive integer quantity.';
    end;
    if v_qty_num is null or v_qty_num < 1 or v_qty_num <> trunc(v_qty_num) or v_qty_num > 1000000 then
      raise exception 'Each cart item requires a positive integer quantity.';
    end if;
    v_quantity := v_qty_num::integer;

    v_client_ft := lower(btrim(coalesce(v_item->>'fulfillment_type', 'seller_pickup')));
    if v_client_ft = '' then
      v_client_ft := 'seller_pickup';
    end if;

    begin
      v_client_fee := coalesce(nullif(trim(v_item->>'deliveryFee'), '')::numeric(12, 2), 0);
    exception
      when others then
        v_client_fee := 0;
    end;

    v_title := coalesce(nullif(v_item->>'title', ''), 'Product');

    v_do_text := null;
    v_do_json := null;

    if v_has_delivery_options and v_delivery_opts_dtype in ('jsonb', 'json') then
      execute format(
        'select seller_id, stock_quantity, coalesce(title, $2::text), %s as gh_price, %s as gh_img, %s as gh_ft, delivery_options::jsonb as gh_do_json
         from public.products where id = $1::%s for update',
        v_price_sql,
        v_image_sql,
        v_ft_sql,
        v_products_id_type
      )
      into v_seller_id, v_stock_quantity, v_title, v_unit_price, v_db_image, v_db_ft, v_do_json
      using v_item_id, v_title;
    elsif v_has_delivery_options
      and v_delivery_opts_dtype = 'ARRAY'
      and coalesce(v_delivery_opts_udt, '') = '_text' then
      execute format(
        'select seller_id, stock_quantity, coalesce(title, $2::text), %s as gh_price, %s as gh_img, %s as gh_ft, delivery_options as gh_do_text
         from public.products where id = $1::%s for update',
        v_price_sql,
        v_image_sql,
        v_ft_sql,
        v_products_id_type
      )
      into v_seller_id, v_stock_quantity, v_title, v_unit_price, v_db_image, v_db_ft, v_do_text
      using v_item_id, v_title;
    else
      execute format(
        'select seller_id, stock_quantity, coalesce(title, $2::text), %s as gh_price, %s as gh_img, %s as gh_ft
         from public.products where id = $1::%s for update',
        v_price_sql,
        v_image_sql,
        v_ft_sql,
        v_products_id_type
      )
      into v_seller_id, v_stock_quantity, v_title, v_unit_price, v_db_image, v_db_ft
      using v_item_id, v_title;
    end if;

    if not found then
      raise exception 'Product % no longer exists.', v_item_id;
    end if;

    if v_seller_id is null then
      raise exception 'Product % is missing a seller.', v_item_id;
    end if;

    if v_unit_price is null or v_unit_price < 0 then
      raise exception 'Product % has an invalid price.', v_item_id;
    end if;

    v_fulfillment_type := coalesce(nullif(btrim(v_db_ft), ''), v_client_ft);

    v_fee_from_opts := null;
    if v_do_json is not null and jsonb_typeof(v_do_json) = 'array' and jsonb_array_length(v_do_json) > 0 then
      if jsonb_typeof(v_do_json->0) = 'object' then
        begin
          v_fee_from_opts := (v_do_json->0->>'fee')::numeric(12, 2);
        exception
          when others then
            v_fee_from_opts := null;
        end;
      end if;
    elsif v_do_text is not null and cardinality(v_do_text) >= 1 then
      v_first_opt := v_do_text[1];
      if v_first_opt is not null and v_first_opt ~ '^\s*\{' then
        begin
          v_fee_from_opts := (v_first_opt::jsonb->>'fee')::numeric(12, 2);
        exception
          when others then
            v_fee_from_opts := null;
        end;
      elsif v_first_opt is not null and btrim(v_first_opt) <> '' then
        v_fee_from_opts := 0;
      end if;
    end if;

    if v_fee_from_opts is null then
      v_fee_from_opts := v_client_fee;
    end if;

    if v_fee_from_opts < 0 then
      v_fee_from_opts := 0;
    end if;

    if lower(v_fulfillment_type) = 'warehouse_shipping' then
      v_has_warehouse := true;
      v_delivery_fee_at_time := 0;
    else
      v_market_delivery_sum := v_market_delivery_sum + v_fee_from_opts;
      v_delivery_fee_at_time := v_fee_from_opts;
    end if;

    v_subtotal := v_subtotal + (v_unit_price * v_quantity);

    if v_stock_quantity is not null then
      if v_stock_quantity < v_quantity then
        raise exception 'Insufficient stock for %. Only % left.', v_title, v_stock_quantity;
      end if;
    end if;

    v_image := coalesce(nullif(btrim(v_db_image), ''), nullif(v_item->>'image', ''));

    if not (v_seller_id = any(v_notified_sellers)) then
      v_notified_sellers := array_append(v_notified_sellers, v_seller_id);
    end if;

    v_specs := v_specs || jsonb_build_array(
      jsonb_build_object(
        'item_id', v_item_id,
        'seller_id', v_seller_id::text,
        'title', v_title,
        'image', coalesce(v_image, ''),
        'quantity', v_quantity,
        'unit_price', v_unit_price,
        'fulfillment_type', v_fulfillment_type,
        'delivery_fee_at_time', v_delivery_fee_at_time
      )
    );
  end loop;

  v_expected_delivery := (case when v_has_warehouse then v_guaranteed_flat else 0 end) + v_market_delivery_sum;
  v_expected_platform := floor(v_subtotal * 0.1 + 0.5)::numeric(14, 2);
  v_expected_total := round(v_subtotal + v_expected_delivery + v_expected_platform, 2);

  if abs(p_delivery_fee - v_expected_delivery) > v_tol then
    raise exception 'Order total mismatch. Please refresh cart and try again.';
  end if;

  if abs(p_platform_fee - v_expected_platform) > v_tol then
    raise exception 'Order total mismatch. Please refresh cart and try again.';
  end if;

  if abs(p_total_amount - v_expected_total) > v_tol then
    raise exception 'Order total mismatch. Please refresh cart and try again.';
  end if;

  execute format(
    'insert into public.orders (
      buyer_id,
      %I,
      delivery_fee,
      platform_fee,
      status,
      payment_reference,
      payment_method,
      shipping_address
    ) values (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8
    )
    returning id',
    v_orders_amount_column
  )
  into v_order_id
  using
    v_buyer_id,
    v_expected_total,
    v_expected_delivery,
    v_expected_platform,
    p_order_status,
    p_payment_reference,
    p_payment_method,
    p_shipping_address;

  for v_line in
    select value from jsonb_array_elements(v_specs)
  loop
    v_item_id := v_line->>'item_id';
    v_seller_id := (v_line->>'seller_id')::uuid;
    v_title := coalesce(v_line->>'title', 'Product');
    v_image := nullif(v_line->>'image', '');
    v_quantity := (v_line->>'quantity')::integer;
    v_unit_price := (v_line->>'unit_price')::numeric(12, 2);
    v_fulfillment_type := coalesce(v_line->>'fulfillment_type', 'seller_pickup');
    v_delivery_fee_at_time := (v_line->>'delivery_fee_at_time')::numeric(12, 2);

    execute format(
      'select stock_quantity from public.products where id = $1::%s for update',
      v_products_id_type
    )
    into v_stock_quantity
    using v_item_id;

    if not found then
      raise exception 'Product % no longer exists.', v_item_id;
    end if;

    if v_stock_quantity is not null then
      if v_stock_quantity < v_quantity then
        raise exception 'Insufficient stock for %. Only % left.', v_title, v_stock_quantity;
      end if;

      execute format(
        'update public.products set stock_quantity = $1 where id = $2::%s',
        v_products_id_type
      )
      using greatest(v_stock_quantity - v_quantity, 0), v_item_id;
    end if;

    execute format(
      'insert into public.order_items (
        order_id,
        product_id,
        seller_id,
        product_title,
        product_image,
        quantity,
        unit_price,
        total_price,
        price_at_time,
        fulfillment_type,
        delivery_fee_at_time,
        status
      ) values (
        $1,
        $2::%s,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        ''pending''
      )',
      v_order_items_product_id_type
    )
    using
      v_order_id,
      v_item_id,
      v_seller_id,
      v_title,
      v_image,
      v_quantity,
      v_unit_price,
      v_unit_price * v_quantity,
      v_unit_price,
      v_fulfillment_type,
      v_delivery_fee_at_time;
  end loop;

  insert into public.order_events (order_id, event_label, metadata)
  values (v_order_id, 'Order Placed', jsonb_build_object('source', p_payment_method));

  if array_length(v_notified_sellers, 1) is not null then
    insert into public.notifications (user_id, type, title, body, data)
    select
      seller_id,
      'order_placed',
      'New order received',
      'A buyer placed a new order. Open Orders to review and fulfill it.',
      jsonb_build_object(
        'order_id', v_order_id,
        'buyer_id', v_buyer_id,
        'payment_method', p_payment_method
      )
    from unnest(v_notified_sellers) as seller_id;
  end if;

  return v_order_id;
end;
$$;

grant execute on function public.create_checkout_order(
  jsonb,
  jsonb,
  numeric,
  numeric,
  numeric,
  text,
  text,
  text
) to authenticated;

notify pgrst, 'reload schema';
