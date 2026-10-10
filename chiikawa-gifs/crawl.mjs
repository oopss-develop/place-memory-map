import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';

const directory = path.dirname(fileURLToPath(import.meta.url));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const decode = text => text.replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
async function request(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { 'User-Agent': 'Personal-GIF-Downloader/1.0', Referer: 'https://chiikawawallpaper.com/ko/gif' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 3) throw error;
      await delay(attempt * 1500);
    }
  }
}
await mkdir(directory, { recursive: true });
try {
  const previous = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (previous.organization) {
    console.log('GIFs are already organized. Use manifest.json and 분류목록.csv to locate the downloaded files.');
    process.exit(0);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const items = new Map();
const pages = [];
for (let page = 1; page <= 13; page++) {
  const url = `https://chiikawawallpaper.com/ko/gif?page=${page}`;
  const html = (await request(url)).toString('utf8');
  const records = [...html.matchAll(/data-wallpaper="([^"]+)"/g)].map(match => JSON.parse(decode(match[1]))).filter(item => item.type === 'gif');
  if (!records.length) throw new Error(`No GIF records on page ${page}`);
  pages.push({ page, url, count: records.length, ids: records.map(item => item.id) });
  for (const record of records) {
    const url = new URL(record.file_name);
    if (url.hostname !== 'r2.chiikawawallpaper.com' || !url.pathname.toLowerCase().endsWith('.gif')) throw new Error(`Unexpected GIF URL: ${url}`);
    const key = url.href;
    if (items.has(key)) { items.get(key).pages.push(page); continue; }
    const original = decodeURIComponent(path.posix.basename(url.pathname)).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    items.set(key, { id: record.id, title: record.title, url: key, pages: [page], filename: `${record.id}-${original}`, status: 'pending' });
  }
  console.log(`Page ${page}/13: ${records.length} GIFs`);
  await delay(200);
}
const manifest = { source: 'https://chiikawawallpaper.com/ko/gif', collectedAt: new Date().toISOString(), pages, files: [...items.values()] };
const save = () => writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await save();
let cursor = 0;
let completed = 0;
async function worker() {
  while (cursor < manifest.files.length) {
    const item = manifest.files[cursor++];
    try {
      const target = path.join(directory, item.filename);
      let data;
      try { data = await readFile(target); } catch {}
      if (!data || !/^GIF8[79]a$/.test(data.subarray(0, 6).toString('ascii'))) data = await request(item.url);
      if (!/^GIF8[79]a$/.test(data.subarray(0, 6).toString('ascii')) || data.length < 14) throw new Error('Invalid GIF data');
      await writeFile(target + '.part', data);
      await rename(target + '.part', target);
      item.status = 'downloaded';
      item.bytes = data.length;
      item.sha256 = createHash('sha256').update(data).digest('hex');
    } catch (error) {
      item.status = 'failed';
      item.error = String(error);
      console.error(`Failed ${item.filename}: ${error}`);
    }
    completed++;
    if (completed % 20 === 0 || completed === manifest.files.length) console.log(`Downloaded ${completed}/${manifest.files.length}`);
    await delay(150);
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
await save();
const failures = manifest.files.filter(item => item.status !== 'downloaded');
console.log(JSON.stringify({ uniqueFiles: manifest.files.length, failed: failures.length, totalBytes: manifest.files.reduce((sum, item) => sum + (item.bytes || 0), 0), directory }));
if (failures.length) process.exitCode = 1;
