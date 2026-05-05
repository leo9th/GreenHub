-- One Paystack (or other) payment reference → at most one order. Enables idempotent server-side finalize after verify.

begin;

create unique index if not exists orders_payment_reference_unique
  on public.orders (payment_reference)
  where payment_reference is not null;

commit;
