import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
const compare = (a, b) => a.localeCompare(b, 'ko', { numeric: true }) || a.localeCompare(b);
const label = name => name.replace(/^\d+[_.\-\s]+/, '');
export async function scanStickers(root, { previewRoot } = {}) {
  const series = [];
  let folders;
  try { folders = await readdir(root, { withFileTypes: true }); } catch (error) { if (error.code === 'ENOENT') return series; throw error; }
  for (const folder of folders.filter(f => f.isDirectory() && !f.name.startsWith('.')).sort((a,b) => compare(a.name,b.name))) {
    const files = await readdir(join(root, folder.name), { withFileTypes: true });
    const stickers = [];
    for (const file of files.filter(f => f.isFile() && !f.name.startsWith('.') && /\.(png|webp|gif)$/i.test(f.name) && !/\.preview\.png$/i.test(f.name)).sort((a,b) => compare(a.name,b.name))) {
      const id = `${folder.name}/${file.name}`;
      const assetUrl = async name => `/stickers/${encodeURIComponent(folder.name)}/${encodeURIComponent(name)}?v=${createHash('sha256').update(await readFile(join(root,folder.name,name))).digest('hex').slice(0,16)}`;
      const animated = /\.gif$/i.test(file.name);
      const preview = file.name.replace(/\.gif$/i, '.preview.png');
      let previewSrc;
      if (animated && files.some(f => f.isFile() && f.name === preview)) previewSrc = await assetUrl(preview);
      else if (animated && previewRoot) {
        const bytes = await readFile(join(root, folder.name, file.name));
        const hash = createHash('sha256').update(bytes).digest('hex');
        const output = join(previewRoot, hash + '.png');
        await mkdir(previewRoot, { recursive: true });
        try { await access(output); } catch {
          await sharp(bytes, { animated: false }).resize(256,256,{fit:'inside',withoutEnlargement:true}).png().toFile(output);
        }
        previewSrc = '/sticker-previews/' + hash + '.png';
      }
      stickers.push({ id, name: label(file.name.replace(/\.[^.]+$/, '')), src: await assetUrl(file.name), animated, ...(previewSrc ? { previewSrc } : {}) });
    }
    if (stickers.length) series.push({ id: folder.name, name: label(folder.name), stickers });
  }
  return series;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const series = await scanStickers(resolve('public/stickers'), { previewRoot: resolve('public/sticker-previews') });
  await mkdir('src/generated', { recursive: true });
  await writeFile('src/generated/stickers.json', JSON.stringify(series, null, 2) + '\n');
  console.log(`Sticker catalog: ${series.length} series, ${series.reduce((n,s) => n+s.stickers.length,0)} stickers`);
}
