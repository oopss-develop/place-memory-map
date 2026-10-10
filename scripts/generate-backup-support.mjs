import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
const schemas = {};
for (const name of (await readdir('supabase/migrations')).filter(n=>n.endsWith('.sql')).sort()) schemas[name] = (await readFile('supabase/migrations/'+name,'utf8')).replace(/^\uFEFF/,'');
await mkdir('src/generated',{recursive:true});
await writeFile('src/generated/backup-support.json',JSON.stringify({ schemas, readme: await readFile('docs/backup/README.md','utf8') },null,2)+'\n');
