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
begin
  if v_buyer_id is null then
    raise exception 'Authentication required to create an order.';
  end if;

  if p_order_status not in ('paid', 'pending_payment') then
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

  insert into public.orders (
    buyer_id,
    total_amount,
    delivery_fee,
    platform_fee,
    status,
    payment_reference,
    payment_method,
    shipping_address
  )
  values (
    v_buyer_id,
    p_total_amount,
    p_delivery_fee,
    p_platform_fee,
    p_order_status,
    p_payment_reference,
    p_payment_method,
    p_shipping_address
  )
  returning id into v_order_id;

  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    v_item_id := nullif(trim(v_item->>'id'), '');
    v_title := coalesce(nullif(v_item->>'title', ''), 'Product');
    v_image := nullif(v_item->>'image', '');
    v_quantity := greatest(1, coalesce((v_item->>'quantity')::integer, 1));
    v_unit_price := coalesce((v_item->>'price')::numeric(12, 2), 0);
    v_delivery_fee_at_time := nullif(v_item->>'deliveryFee', '')::numeric(12, 2);
    v_fulfillment_type := coalesce(nullif(trim(v_item->>'fulfillment_type'), ''), 'seller_pickup');

    if v_item_id is null then
      raise exception 'Cart item is missing a product id.';
    end if;

    execute format(
      'select seller_id, stock_quantity, coalesce(title, $2) from public.products where id = $1::%s for update',
      v_products_id_type
    )
    into v_seller_id, v_stock_quantity, v_title
    using v_item_id, v_title;

    if not found then
      raise exception 'Product % no longer exists.', v_item_id;
    end if;

    if v_seller_id is null then
      raise exception 'Product % is missing a seller.', v_item_id;
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
