-- Waybill / tracking ID when seller marks line item as shipped
alter table public.order_items
  add column if not exists tracking_ref text;

comment on column public.order_items.tracking_ref is 'Carrier waybill or tracking ID; set when status is shipped.';
