import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

// Run from the repository root after updating the approved source artwork.
const source = "docs/branding/uttumak-icon-03-v5.png";
await mkdir("public", { recursive: true });
const outputs = [
  ["public/app-icon-192.png", 192],
  ["public/app-icon-512.png", 512],
  ["public/brand-icon-v4.png", 128],
  ["src/app/icon.png", 512],
  ["src/app/apple-icon.png", 180],
];
for (const [path, size] of outputs) {
  await sharp(source).resize(size, size).png().toFile(path);
}

// The artwork has an edge-to-edge background. Android supplies the outer mask;
// an inset or pre-rounded tile would produce a small icon within another icon.
await sharp(source).resize(512, 512).removeAlpha().png()
  .toFile("public/app-icon-maskable-512.png");

// ICO supports PNG entries; include native sizes for browser and desktop tabs.
const sizes = [16, 32, 48];
// Next.js's ICO decoder requires embedded PNGs to use RGBA (PNG color type 6).
const frames = await Promise.all(sizes.map(size => sharp(source).resize(size, size).ensureAlpha().png().toBuffer()));
for (const frame of frames) {
  if (frame[25] !== 6) throw new Error("ICO frames must be RGBA PNG images");
}
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile("src/app/favicon.ico", Buffer.concat([header, ...frames]));
const circleMask = Buffer.from('<svg width="512" height="512"><circle cx="256" cy="256" r="256" fill="white"/></svg>');
await sharp("public/app-icon-maskable-512.png").ensureAlpha()
  .composite([{ input: circleMask, blend: "dest-in" }]).png()
  .toFile("docs/branding/uttumak-android-circle-preview.png");
console.log("Generated 우뚜막 brand, favicon, Apple and PWA icons.");
