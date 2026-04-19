-- Post-signup SMS verification flag (optional until required for sensitive actions)
alter table public.profiles add column if not exists phone_verified boolean not null default false;

comment on column public.profiles.phone_verified is 'Set true after successful SMS OTP verification on profile.';
