CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE user_id = auth.uid() AND read_at IS NULL;
END;
$$;
