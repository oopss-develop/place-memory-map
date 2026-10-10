import assert from 'node:assert/strict';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { backupTables } from '../src/lib/backup-format.ts';
import { openBackup, hash } from './backup-io.mjs';

const folder = await mkdtemp(join(tmpdir(), 'uttumak-backup-check-'));
const filename = join(folder, 'backup.zip');
const userId = '10000000-0000-4000-8000-000000000001';
const snapshot = { format: 'uttumak-backup', version: 1, createdAt: new Date().toISOString(), userId,
  data: Object.fromEntries(backupTables.map(table => [table, []])) };
snapshot.data.visit_photos = [{ storage_path: 'group/visit/photo.webp', upload_state: 'complete' }];
const json = Buffer.from(JSON.stringify(snapshot));
const image = Buffer.from([1, 2, 3]);
const manifest = { format: 'uttumak-backup', version: 1, createdAt: snapshot.createdAt, photosIncluded: true, stickersIncluded: false,
  files: [{ path: 'backup.json', bytes: json.length, sha256: hash(json) }, { path: 'photos/group/visit/photo.webp', bytes: image.length, sha256: hash(image) }] };
async function archive({ corrupt = false, missing = false, unsafe = false } = {}) {
  const zip = new JSZip();
  zip.file('backup.json', json);
  zip.file('photos/group/visit/photo.webp', corrupt ? Buffer.from('bad bytes') : image);
  zip.file('manifest.json', JSON.stringify(missing ? { ...manifest, files: manifest.files.slice(0, 1) } : manifest));
  if (unsafe) zip.file('../escape.txt', 'unsafe');
  await writeFile(filename, await zip.generateAsync({ type: 'nodebuffer' }));
}
try {
  await archive();
  const verified = await openBackup(filename);
  assert.deepEqual(verified.snapshot, snapshot);
  assert.deepEqual(await verified.read('photos/group/visit/photo.webp'), image);
  await archive({ corrupt: true });
  await assert.rejects(() => openBackup(filename), /Corrupt backup file/);
  await archive({ missing: true });
  await assert.rejects(() => openBackup(filename), /Missing photo original/);
  await archive({ unsafe: true });
  await assert.rejects(() => openBackup(filename), /Unsafe ZIP entry/);
  console.log('Backup archive verification: originals, corruption, missing files and unsafe paths passed.');
} finally {
  await unlink(filename).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await rmdir(folder);
}
