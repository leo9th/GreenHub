-- Add seller-specific fields to the profiles table
alter table public.profiles
  add column if not exists last_active timestamp with time zone default now(),
  add column if not exists auto_reply_message text;

-- Create a helper function to easily update the user's last_active timestamp
create or replace function public.update_last_active()
returns void as $$
begin
  update public.profiles
  set last_active = now()
  where id = auth.uid();
end;
$$ language plpgsql security definer;
