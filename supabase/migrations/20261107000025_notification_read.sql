-- =============================================================================
-- Mark a single notification as read.
--
-- Until now only mark_all_notifications_read() existed, so the inbox could not
-- clear one item and the header badge stayed until "خواندن همه".
-- =============================================================================

create or replace function public.mark_notification_read(p_id bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where id = p_id
    and user_id = (select auth.uid())
    and read_at is null;
$$;

revoke execute on function public.mark_notification_read(bigint) from public, anon;
grant execute on function public.mark_notification_read(bigint) to authenticated;