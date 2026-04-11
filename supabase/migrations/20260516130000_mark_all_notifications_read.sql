-- Mark all in-app notifications read for the current user (bypasses RLS safely via auth.uid()).

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.notifications
  set read_at = now()
  where user_id = auth.uid()
    and read_at is null;
end;
$$;

comment on function public.mark_all_notifications_read() is
  'Sets read_at on all unread notifications for auth.uid(). Used by the app bell / notifications panel.';

grant execute on function public.mark_all_notifications_read() to authenticated;
