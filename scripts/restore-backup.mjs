import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import { mkdir, readFile, writeFile, access, realpath } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { backupTables, safeBackupPath } from '../src/lib/backup-format.ts';
import { restoreBackupData } from './restore-backup-data.mjs';
import { openBackup, hash } from './backup-io.mjs';
loadEnvConfig(process.cwd());
const args=process.argv.slice(2);
const option=name=>args.includes(name)?args[args.indexOf(name)+1]:undefined;
const archive=option('--file');
if(!archive){console.error('Usage: npm run backup:restore -- --file BACKUP.zip [--profile-map MAP.json] [--assets-out NEW_FOLDER] [--apply]');process.exit(1);}
const apply=args.includes('--apply');
const connectionString=process.env.BACKUP_DATABASE_URL, serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY, url=process.env.NEXT_PUBLIC_SUPABASE_URL;
if(!connectionString || !serviceKey || !url)throw new Error('Set BACKUP_DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in .env.local');
let dbUrl,storageUrl;try{dbUrl=new URL(connectionString);storageUrl=new URL(url);}catch{throw new Error('Invalid backup connection settings');}
const projectRef=storageUrl.hostname.split('.')[0];
const dbRef=/^db\.([^.]+)\.supabase\.co$/.exec(dbUrl.hostname)?.[1] ?? decodeURIComponent(dbUrl.username).split('.')[1];
if(!dbRef || dbRef!==projectRef)throw new Error('Database and Storage must be from the same Supabase project. Use the project connection string.');
const backup=await openBackup(archive);
if(!backup.manifest.photosIncluded && backup.snapshot.data.visit_photos.some(p=>p.upload_state!=='pending'))throw new Error('This backup excludes photo originals. Full restore is blocked.');
const mapping=option('--profile-map')?JSON.parse(await readFile(option('--profile-map'),'utf8')):{};
for(const [oldId,newId] of Object.entries(mapping))if(!/^[0-9a-f-]{36}$/i.test(oldId) || typeof newId!=='string' || !/^[0-9a-f-]{36}$/i.test(newId))throw new Error('Invalid profile mapping');
const userColumns=new Set(['user_id','created_by','updated_by','uploaded_by','author_id','actor_id']);
const data=structuredClone(backup.snapshot.data);
for(const table of backupTables)for(const row of data[table])for(const [key,value] of Object.entries(row))if((userColumns.has(key) || table==='profiles' && key==='id') && typeof value==='string' && mapping[value])row[key]=mapping[value];
const db=new Client({connectionString});
const storage=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

let transaction=false;
try {
  await db.connect();
  const ids=[...new Set(data.profiles.map(p=>p.id))];
  const authUsers=await db.query('select id from auth.users where id = any($1::uuid[])',[ids]);
  const existing=new Set(authUsers.rows.map(r=>r.id));
  if(ids.some(id=>!existing.has(id)))throw new Error('Some original accounts do not exist. Create target login accounts and provide --profile-map. No data was changed.');
  const columns=await db.query("select table_name,column_name from information_schema.columns where table_schema='public' and table_name=any($1::text[])",[backupTables]);
  const allowed=new Map();for(const row of columns.rows){if(!allowed.has(row.table_name))allowed.set(row.table_name,new Set());allowed.get(row.table_name).add(row.column_name);}
  for(const table of backupTables) {
    if(!allowed.has(table))throw new Error('Target schema is not ready: '+table);
    for(const row of data[table])for(const key of Object.keys(row))if(!allowed.get(table).has(key))throw new Error('Target schema lacks '+table+'.'+key);
  }
  console.log('Verified backup:',backup.snapshot.createdAt);
  for(const table of backupTables)console.log(table+': '+data[table].length+' backed-up rows (existing IDs will be kept)');
  console.log('Photos:',backup.manifest.files.filter(f=>f.path.startsWith('photos/')).length);
  if(!apply){console.log('Validation only. No database, Storage or local files changed. Add --apply to restore.');process.exitCode=0;}
  else {
    // Storage inserts use unique original paths and never overwrite existing files.
    for(const file of backup.manifest.files.filter(f=>f.path.startsWith('photos/'))) {
      const path=file.path.slice(7);const bytes=await backup.read(file.path);
      let current=await storage.storage.from('visit-photos').download(path);
      if(!current.error){if(hash(Buffer.from(await current.data.arrayBuffer()))!==file.sha256)throw new Error('Different photo already exists: '+path);continue;}
      if(!/not found/i.test(current.error.message) && String(current.error.statusCode)!=='404')throw new Error('Unable to check existing Storage file: '+path);
      const result=await storage.storage.from('visit-photos').upload(path,bytes,{contentType:file.mime ?? 'image/webp',upsert:false});
      if(result.error) {
        current=await storage.storage.from('visit-photos').download(path);
        if(current.error || hash(Buffer.from(await current.data.arrayBuffer()))!==file.sha256)throw new Error('Photo upload failed: '+path);
      }
    }
    await db.query('begin');transaction=true;
    await restoreBackupData(db,data,console.log);
    await db.query('commit');transaction=false;
    console.log('Database restore completed. Existing rows and photos were preserved.');
    const assets=resolve(option('--assets-out') ?? backup.root+'-restored-assets');
    await mkdir(assets,{recursive:true}); const assetsBase=await realpath(assets);
    for(const file of backup.manifest.files.filter(f=>f.path.startsWith('stickers/') || f.path.startsWith('sticker-previews/'))) {
      const path=file.path.startsWith('sticker-previews/')?'stickers/'+file.path.slice('sticker-previews/'.length).replace(/\.png$/,'.preview.png'):file.path;
      if(!safeBackupPath(path))throw new Error('Unsafe asset path');
      const target=join(assets,path);await mkdir(resolve(target,'..'),{recursive:true});
      const parent=await realpath(resolve(target,'..'));if(!parent.toLowerCase().startsWith((assetsBase+sep).toLowerCase()))throw new Error('Asset path escapes output folder');
      try{const actual=await realpath(target);if(!actual.toLowerCase().startsWith((assetsBase+sep).toLowerCase()))throw new Error('Asset path escapes output folder');}catch(error){if(error.code!=='ENOENT')throw error;}
      try{await access(target);if(hash(await readFile(target))!==file.sha256)throw new Error('Different asset exists: '+target);}catch(error){if(error.code!=='ENOENT')throw error;await writeFile(target,await backup.read(file.path),{flag:'wx'});}
    }
    console.log('Database restore completed. Existing rows and photos were preserved.');
    console.log('Review extracted sticker files in:',assets,'then copy to public/stickers and redeploy.');
  }
} catch(error){if(transaction)await db.query('rollback');console.error('Restore failed:',error.message);process.exitCode=1;}
finally{await db.end();}
