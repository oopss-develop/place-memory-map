import { readFile, writeFile } from 'node:fs/promises';
const names = ['202610100001_visit_comments.sql','202610100002_comment_stickers.sql','202610100003_sticker_favorites.sql','202610100004_comment_notifications.sql'];
const parts = [];
for (const name of names) {
  let sql = await readFile('supabase/migrations/' + name, 'utf8');
  sql = sql.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
    .replace(/create table public\./g, 'create table if not exists public.')
    .replace(/create index /g, 'create index if not exists ')
    .replace(/create (?:or replace )?function /g, 'create or replace function ')
    .replace(/add column sticker_id/g, 'add column if not exists sticker_id')
    .replace(/drop constraint (?!if exists)/g, 'drop constraint if exists ')
    .replace(/alter table public\.visit_comments add constraint (\w+)/g, (_, name) => `alter table public.visit_comments drop constraint if exists ${name};\nalter table public.visit_comments add constraint ${name}`)
    .replace(/create policy (\w+) on (public\.\w+)/g, (_, policy, table) => `drop policy if exists ${policy} on ${table};\ncreate policy ${policy} on ${table}`)
    .replace(/create trigger (\w+) after insert on (public\.\w+)/g, (_, trigger, table) => `drop trigger if exists ${trigger} on ${table};\ncreate trigger ${trigger} after insert on ${table}`);
  parts.push('-- ' + name + '\n' + sql);
}
await writeFile('supabase/repair-comment-setup.sql', '-- Repeatable repair for existing comment DBs. Preserves comments, favorites and read receipts.\n-- Run in Supabase SQL Editor, in the project configured in Vercel.\nbegin;\n\n' + parts.join('\n\n') + "\nnotify pgrst, 'reload schema';\ncommit;\n");
