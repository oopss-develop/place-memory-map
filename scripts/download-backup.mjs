import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { loadEnvConfig } from '@next/env';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { scanStickers } from './generate-sticker-catalog.mjs';
import { snapshotSchema, safeBackupPath, offlineBackupHtml } from '../src/lib/backup-format.ts';
import { hash } from './backup-io.mjs';
loadEnvConfig(process.cwd());
const args=process.argv.slice(2);const output=args.includes('--out')?args[args.indexOf('--out')+1]:undefined;
if(!output){console.error('Usage: npm run backup:download -- --out NEW_EMPTY_FOLDER');process.exit(1);}
const connectionString=process.env.BACKUP_DATABASE_URL,url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY,userId=process.env.BACKUP_USER_ID;
if(!connectionString || !url || !key || !/^[0-9a-f-]{36}$/i.test(userId ?? ''))throw new Error('Set BACKUP_DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL and BACKUP_USER_ID');
let databaseUrl,storageUrl;try{databaseUrl=new URL(connectionString);storageUrl=new URL(url);}catch{throw new Error('Invalid backup connection settings');}
const ref=/^db\.([^.]+)\.supabase\.co$/.exec(databaseUrl.hostname)?.[1] ?? decodeURIComponent(databaseUrl.username).split('.')[1];
if(!ref || ref!==storageUrl.hostname.split('.')[0])throw new Error('Database and Storage connection settings must refer to the same Supabase project');
const db=new Client({connectionString});const storage=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
try {
  await db.connect();
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[userId]);
  const result=await db.query('select public.export_workspace_backup() as snapshot');
  const snapshot=snapshotSchema.parse(result.rows[0].snapshot);
  const root=resolve(output);await mkdir(dirname(root),{recursive:true});await mkdir(root);
  const files=[];
  async function add(path,bytes,mime) {
    if(!safeBackupPath(path))throw new Error('Unsafe backup path');
    const target=join(root,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});
    files.push({path,bytes:bytes.length,sha256:hash(bytes),...(mime?{mime}:{})});
  }
  const text=(path,value)=>add(path,Buffer.from(value,'utf8'));
  await text('backup.json',JSON.stringify(snapshot,null,2));
  await text('기록보기.html',offlineBackupHtml(snapshot,true));
  await add('복원안내.md',await readFile('docs/backup/README.md'));
  for(const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort())await add('schema/'+name,await readFile('supabase/migrations/'+name));
  const photos=snapshot.data.visit_photos.filter(p=>p.upload_state!=='pending');
  for(const [i,photo] of photos.entries()) {
    const path=String(photo.storage_path);if(!safeBackupPath(path))throw new Error('Unsafe photo path');
    const result=await storage.storage.from('visit-photos').download(path);if(result.error)throw new Error('Photo is missing or inaccessible: '+path);
    await add('photos/'+path,Buffer.from(await result.data.arrayBuffer()),result.data.type);
    console.log('Photos:',i+1+'/'+photos.length);
  }
  const series=await scanStickers(resolve('public/stickers'));
  await text('sticker-catalog.json',JSON.stringify(series,null,2));
  for(const item of series.flatMap(s=>s.stickers)) {
    await add('stickers/'+item.id,await readFile(join('public/stickers',item.id)));
    if(item.previewSrc)await add('sticker-previews/'+item.id.replace(/\.[^.]+$/,'.png'),await readFile(join('public/stickers',item.id.replace(/\.gif$/i,'.preview.png'))));
  }
  // Only a complete folder gets a manifest. Partial folders are never valid backups.
  await writeFile(join(root,'manifest.json'),JSON.stringify({format:'uttumak-backup',version:1,createdAt:snapshot.createdAt,photosIncluded:true,stickersIncluded:true,files},null,2),{flag:'wx'});
  console.log('Complete backup saved:',root);
} catch(error){console.error('Backup failed:',error.message);process.exitCode=1;}
finally{await db.end();}
