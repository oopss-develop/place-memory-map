import { backupTables } from '../src/lib/backup-format.ts';
const quote=name=>'"'+name.replaceAll('"','""')+'"';
// Caller owns the transaction. Constraints remain active during historical inserts.
export async function restoreBackupData(db,data,log=()=>{}) {
    // Preserve historical timestamps and avoid sending fresh alerts for old comments.
    // Disable only currently enabled USER triggers. FK/check constraints stay enabled.
    const triggers=await db.query("select c.relname as table_name,t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any($1::text[]) and not t.tgisinternal and t.tgenabled='O'",[backupTables]);
    for(const t of triggers.rows)await db.query(`alter table public.${quote(t.table_name)} disable trigger ${quote(t.tgname)}`);
    for(const table of backupTables) {
      const rows=data[table];if(!rows.length)continue;
      const names=[...new Set(rows.flatMap(row=>Object.keys(row)))];const list=names.map(quote).join(',');
      const result=await db.query(`insert into public.${quote(table)} (${list}) overriding system value select ${list} from jsonb_populate_recordset(null::public.${quote(table)},$1::jsonb) on conflict do nothing`,[JSON.stringify(rows)]);
      log('Inserted '+table+': '+result.rowCount+'; kept existing: '+(rows.length-result.rowCount));
    }
    // Explicit identity values must not collide with future activity logs.
    await db.query("select setval(pg_get_serial_sequence('public.activity_logs','id'),greatest(coalesce((select max(id) from public.activity_logs),1),(select last_value from public.activity_logs_id_seq)),true)");
    for(const t of triggers.rows)await db.query(`alter table public.${quote(t.table_name)} enable trigger ${quote(t.tgname)}`);

}
