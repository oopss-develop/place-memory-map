-- Application conflicts are terminal HTTP 409 responses, not serialization failures.
-- PostgREST 14 can retry SQLSTATE 40001 indefinitely. Keep version checks intact.
-- Patch installed definitions so this also covers legacy RPCs and partial setups.
begin;
do $migration$
declare
  routine record;
  definition text;
begin
  for routine in
    select p.oid
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    join pg_catalog.pg_language l on l.oid = p.prolang
    where n.nspname in ('public', 'private')
      and p.prokind = 'f' and l.lanname = 'plpgsql'
  loop
    definition := pg_catalog.pg_get_functiondef(routine.oid);
    if definition ~* $pattern$errcode\s*=\s*'40001'$pattern$ then
      execute pg_catalog.regexp_replace(
        definition, $pattern$errcode\s*=\s*'40001'$pattern$, 'errcode = ''PT409''', 'gi'
      );
    end if;
  end loop;
end
$migration$;
notify pgrst, 'reload schema';
commit;
