-- Run this read-only check in the SAME Supabase project used by Vercel.
select name, applied from (
  select '202610100001_visit_comments.sql' as name, to_regclass('public.visit_comments') is not null as applied
  union all
  select '202610100002_comment_stickers.sql', exists(select 1 from information_schema.columns where table_schema='public' and table_name='visit_comments' and column_name='sticker_id')
  union all
  select '202610100003_sticker_favorites.sql', to_regclass('public.sticker_favorites') is not null
  union all
  select '202610100004_comment_notifications.sql', to_regclass('public.comment_notifications') is not null
) checks order by name;
-- Run missing migration files in name order, then refresh the schema cache:
notify pgrst, 'reload schema';
