// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { Blob as NodeBlob } from "node:buffer";
import JSZip from "jszip";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorkspaceBackup } from "./workspace-backup";
import { backupHash, backupTables, offlineBackupHtml, parseManifest, safeBackupPath, snapshotSchema, validateBackupCoverage } from "./backup-format";

const userId = "10000000-0000-4000-8000-000000000001";
const photoPath = "group/visit/사진.webp";
function fixture() {
  const data = Object.fromEntries(backupTables.map(table => [table, []]));
  return snapshotSchema.parse({ format: "uttumak-backup", version: 1, createdAt: "2026-10-11T00:00:00Z", userId, data: { ...data,
    groups: [{ id: "group", name: "우리 지도" }],
    visits: [{ id: "visit", group_id: "group", title: "<script>alert(1)</script>", note: "소중한 기억" }],
    visit_photos: [{ visit_id: "visit", storage_path: photoPath, upload_state: "complete" }],
    visit_comments: [{ visit_id: "visit", author_id: userId, body: "안녕", sticker_id: "우삼/안녕#1.gif" }],
  } });
}
function client(snapshot = fixture(), signedUrl = "https://photos.test/original") {
  return { rpc: vi.fn(() => ({ abortSignal: vi.fn().mockResolvedValue({ data: snapshot, error: null }) })), storage: { from: vi.fn(() => ({ createSignedUrls: vi.fn().mockResolvedValue({ data: [{ signedUrl }], error: null }) })) } } as unknown as SupabaseClient;
}
beforeEach(() => {
  const settings = new Map<string, string>();
  vi.stubGlobal("localStorage", { get length() { return settings.size; }, key: (i: number) => [...settings.keys()][i], getItem: (key: string) => settings.get(key) ?? null, setItem: (key: string, value: string) => settings.set(key, value) });
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url === "/api/backup/support") return Response.json({ readme: "복원 안내", schemas: { "schema.sql": "create table test();" } });
    if (url === "/api/stickers") return Response.json({ series: [{ id: "우삼", name: "우삼", stickers: [{ id: "우삼/안녕#1.gif", src: "/gif", animated: true }] }] });
    return new Response(new Uint8Array([1, 2, 3, 4]), { headers: { "content-type": "image/webp" } });
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("whole workspace backup", () => {
  it("includes original bytes, schemas, offline records and app settings, with verified checksums", async () => {
    localStorage.setItem("uttumak-setting", "keep");
    localStorage.setItem("sb-auth-token", "secret");
    const result = await createWorkspaceBackup(client(), { photos: true, stickers: true, signal: new AbortController().signal, progress: vi.fn() });
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const manifest = parseManifest(JSON.parse(await zip.file("manifest.json")!.async("string")));
    for (const file of manifest.files) {
      const bytes = await zip.file(file.path)!.async("uint8array");
      expect(bytes.length).toBe(file.bytes);
      expect(await backupHash(bytes)).toBe(file.sha256);
    }
    validateBackupCoverage(manifest, fixture());
    expect(await zip.file("photos/" + photoPath)!.async("uint8array")).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(zip.file("stickers/우삼/안녕#1.gif")).not.toBeNull();
    expect(zip.file("schema/schema.sql")).not.toBeNull();
    expect(await zip.file("local-settings.json")!.async("string")).not.toContain("secret");
    const html = await zip.file("기록보기.html")!.async("string");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("%231.gif");
  });
  it("does not return a completed archive when a photo download fails", async () => {
    vi.mocked(fetch).mockImplementation(async url => String(url).includes("photos.test") ? new Response("missing", { status: 404 }) : Response.json({ readme: "", schemas: {} }));
    await expect(createWorkspaceBackup(client(), { photos: true, stickers: false, signal: new AbortController().signal, progress: vi.fn() })).rejects.toThrow("사진 다운로드");
  });
  it("marks metadata-only archives and never loads photo originals", async () => {
    const result = await createWorkspaceBackup(client(), { photos: false, stickers: false, signal: new AbortController().signal, progress: vi.fn() });
    expect(result.manifest.photosIncluded).toBe(false);
    expect(vi.mocked(fetch).mock.calls.every(([url]) => !String(url).includes("photos.test"))).toBe(true);
  });
  it("rejects missing originals, unsafe paths and duplicate manifest paths", () => {
    const manifest = { format: "uttumak-backup" as const, version: 1 as const, createdAt: "today", photosIncluded: true, stickersIncluded: false, files: [{ path: "backup.json", bytes: 1, sha256: "a".repeat(64) }] };
    expect(() => validateBackupCoverage(manifest, fixture())).toThrow("사진 원본");
    for (const path of ["../photo", "/photo", "C:/photo", "a\\b", "a/../b"]) expect(safeBackupPath(path)).toBe(false);
    expect(() => parseManifest({ ...manifest, files: [manifest.files[0], manifest.files[0]] })).toThrow("중복");
    expect(offlineBackupHtml(fixture(), false)).not.toContain('src="photos/');
  });
  it("stops before producing a ZIP when canceled", async () => {
    const abort = new AbortController(); abort.abort();
    await expect(createWorkspaceBackup(client(), { photos: true, stickers: true, signal: abort.signal, progress: vi.fn() })).rejects.toThrow();
  });
});
