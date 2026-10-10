import type { SupabaseClient } from "@supabase/supabase-js";
import type { StickerSeries } from "./stickers";
import { apiRequest } from "./api-request";
import { backupHash, offlineBackupHtml, safeBackupPath, snapshotSchema, type BackupFile, type BackupManifest } from "./backup-format";
export async function createWorkspaceBackup(db: SupabaseClient, options: { photos: boolean; stickers: boolean; signal: AbortSignal; progress: (text: string) => void }) {
  const { signal, progress } = options;
  progress("전체 기록을 모으는 중…");
  const { data, error } = await db.rpc("export_workspace_backup").abortSignal(signal);
  if (error) throw new Error(error.code === "PGRST202" ? "백업 DB 설정이 필요합니다. 202610110001_workspace_backup.sql을 적용해 주세요." : "기록을 백업하지 못했습니다. 다시 시도해 주세요.");
  const snapshot = snapshotSchema.parse(data);
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const files: BackupFile[] = [];
  let total = 0;
  const add = async (path: string, bytes: Uint8Array, mime?: string) => {
    signal.throwIfAborted();
    if (!safeBackupPath(path) || files.some(file=>file.path===path)) throw new Error("백업 파일 경로를 확인해 주세요.");
    total += bytes.byteLength;
    if (total > 512*1024*1024) throw new Error("백업이 512MB를 넘습니다. PC의 폴더 백업 도구(backup:download)를 사용해 주세요.");
    zip.file(path,bytes);
    files.push({ path, bytes: bytes.byteLength, sha256: await backupHash(bytes), ...(mime ? { mime } : {}) });
  };
  const addText = (path: string, value: string) => add(path,new TextEncoder().encode(value));
  await addText("backup.json",JSON.stringify(snapshot,null,2));
  const local: Record<string,string> = {};
  for (let i=0;i<localStorage.length;i++) { const key=localStorage.key(i); if (key && /^(place-memory-|uttumak-)/.test(key)) local[key]=localStorage.getItem(key) ?? ""; }
  await addText("local-settings.json",JSON.stringify(local,null,2));
  const support = await apiRequest<{ readme: string; schemas: Record<string,string> }>("/api/backup/support",{signal});
  await addText("복원안내.md",support.readme);
  for (const [name,sql] of Object.entries(support.schemas)) await addText("schema/"+name,sql);
  await addText("기록보기.html",offlineBackupHtml(snapshot,options.photos));
  if (options.photos) {
    const photos = snapshot.data.visit_photos.filter(p=>p.upload_state!=="pending");
    for (let offset=0;offset<photos.length;offset+=100) {
      signal.throwIfAborted();
      const batch=photos.slice(offset,offset+100);
      const { data: urls, error: signError } = await db.storage.from("visit-photos").createSignedUrls(batch.map(p=>String(p.storage_path)),3600);
      if (signError || !urls) throw new Error("사진 다운로드 주소를 만들지 못했습니다. 전체 백업을 중단했어요.");
      for (const [i,photo] of batch.entries()) {
        progress(`사진 원본 저장 중… ${offset+i+1}/${photos.length}`);
        const url=urls[i]?.signedUrl;
        if (!url) throw new Error("일부 사진 원본을 찾을 수 없어 전체 백업을 중단했어요.");
        const response=await fetch(url,{signal});
        if (!response.ok) throw new Error("사진 다운로드에 실패해 전체 백업을 중단했어요. 다시 시도해 주세요.");
        await add("photos/"+photo.storage_path,new Uint8Array(await response.arrayBuffer()),response.headers.get("content-type") ?? undefined);
      }
    }
  }
  if (options.stickers) {
    const catalog=await apiRequest<{series:StickerSeries[]}>("/api/stickers",{signal});
    await addText("sticker-catalog.json",JSON.stringify(catalog.series,null,2));
    const stickers=catalog.series.flatMap(s=>s.stickers);
    for (const [i,sticker] of stickers.entries()) {
      progress(`이모티콘 저장 중… ${i+1}/${stickers.length}`);
      const response=await fetch(sticker.src,{signal});
      if (!response.ok) throw new Error("이모티콘 파일 다운로드에 실패했습니다.");
      await add("stickers/"+sticker.id,new Uint8Array(await response.arrayBuffer()));
      if (sticker.previewSrc) {
        const preview=await fetch(sticker.previewSrc,{signal});
        if (!preview.ok) throw new Error("이모티콘 미리보기 다운로드에 실패했습니다.");
        await add("sticker-previews/"+sticker.id.replace(/\.[^.]+$/,".png"),new Uint8Array(await preview.arrayBuffer()));
      }
    }
  }
  const manifest:BackupManifest={format:"uttumak-backup",version:1,createdAt:snapshot.createdAt,photosIncluded:options.photos,stickersIncluded:options.stickers,files};
  zip.file("manifest.json",JSON.stringify(manifest,null,2));
  progress("백업 ZIP 파일을 만드는 중…");
  const blob=await zip.generateAsync({type:"blob",compression:"STORE",streamFiles:true},()=>signal.throwIfAborted());
  signal.throwIfAborted();
  const date=new Date().toLocaleString("sv-SE",{timeZone:"Asia/Seoul"}).replace(/[: ]/g,"-");
  return { blob, filename:`우뚜막-${options.photos ? "전체" : "데이터"}-백업-${date}.zip`, snapshot, manifest };
}
