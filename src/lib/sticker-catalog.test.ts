// @vitest-environment node
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { scanStickers } from "../../scripts/generate-sticker-catalog.mjs";
it("scans immediate series, sorts numeric names, excludes previews and versions replacements", async () => {
  const root = await mkdtemp(join(tmpdir(), "stickers-"));
  try {
    for (const folder of ["02_뚜냥", "01_우삼", ".hidden", "empty", "01_우삼/nested"]) await mkdir(join(root, folder), { recursive: true });
    for (const name of ["root.png", ".hidden/one.png", "01_우삼/10_춤.gif", "01_우삼/10_춤.preview.png", "01_우삼/02_안녕.PNG", "01_우삼/.secret.png", "01_우삼/skip.svg", "01_우삼/nested/skip.png", "02_뚜냥/01_좋아요.webp"]) await writeFile(join(root, name), name);
    const list = await scanStickers(root);
    expect(list.map(s => s.name)).toEqual(["우삼", "뚜냥"]);
    expect(list[0].stickers.map((s: { name: string }) => s.name)).toEqual(["안녕", "춤"]);
    expect(list[0].stickers[1].previewSrc).toContain(".preview.png?v=");
    const original = list[0].stickers[0];
    await writeFile(join(root, original.id), "replaced");
    const replaced = (await scanStickers(root))[0].stickers[0];
    expect(replaced.id).toBe(original.id); expect(replaced.src).not.toBe(original.src);
    await rm(join(root,"01_우삼"), { recursive: true });
    expect((await scanStickers(root)).map(s => s.name)).toEqual(["뚜냥"]);
  } finally { await rm(root, { recursive: true }); }
});
