import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep, join } from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { parseManifest, safeBackupPath, snapshotSchema } from '../src/lib/backup-format.ts';
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function openBackup(path) {
  const root = resolve(path); const info = await stat(root);
  let read;
  if (info.isDirectory()) {
    const base = await realpath(root);
    read = async name => {
      if (!safeBackupPath(name)) throw new Error('Unsafe archive path');
      const target = await realpath(join(root,name));
      if (!target.toLowerCase().startsWith((base + sep).toLowerCase())) throw new Error('Archive path escapes backup directory');
      return readFile(target);
    };
  } else {
    const zip = await JSZip.loadAsync(await readFile(root));
    for (const entry of Object.values(zip.files)) if (!entry.dir && !safeBackupPath(entry.unsafeOriginalName ?? entry.name)) throw new Error('Unsafe ZIP entry');
    read = async name => { if (!safeBackupPath(name)) throw new Error('Unsafe archive path'); const entry=zip.file(name);if(!entry)throw new Error('Missing file: '+name);return entry.async('nodebuffer'); };
  }
  const manifest = parseManifest(JSON.parse((await read('manifest.json')).toString('utf8')));
  if (!manifest.files.some(f=>f.path==='backup.json')) throw new Error('backup.json is not covered by checksums');
  for (const file of manifest.files) {
    const bytes=await read(file.path);
    if(bytes.length!==file.bytes || hash(bytes)!==file.sha256)throw new Error('Corrupt backup file: '+file.path);
  }
  const snapshot=snapshotSchema.parse(JSON.parse((await read('backup.json')).toString('utf8')));
  const paths=new Set(manifest.files.map(f=>f.path));
  if(manifest.photosIncluded)for(const photo of snapshot.data.visit_photos.filter(p=>p.upload_state!=='pending')) {
    if(!safeBackupPath(String(photo.storage_path)) || !paths.has('photos/'+photo.storage_path))throw new Error('Missing photo original: '+photo.storage_path);
  }
  return {manifest,snapshot,read,root};
}
