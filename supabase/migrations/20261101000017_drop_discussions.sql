-- The discussions feature was removed from the product; both tables are empty,
-- so drop them instead of leaving dead schema behind.
drop table if exists public.discussion_posts;
drop table if exists public.discussion_threads;
drop function if exists public.list_discussion_threads(integer, integer);
drop function if exists public.get_discussion_thread(uuid);
drop function if exists public.list_discussion_posts(uuid);
drop function if exists public.prepare_discussion_thread();
drop function if exists public.prepare_discussion_post();
drop function if exists public.sync_thread_activity();
