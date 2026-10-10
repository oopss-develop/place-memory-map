import { z } from "zod";
export const backupTables = ["profiles","groups","group_members","places","visits","visit_participants","visit_photos","trips","schedule_items","trip_route_cache","visit_comments","activity_logs","sticker_favorites","comment_notifications","workspace_save_requests"] as const;
const row = z.record(z.string(),z.unknown());
const dataShape = Object.fromEntries(backupTables.map(table=>[table,z.array(row)])) as Record<typeof backupTables[number], z.ZodArray<typeof row>>;
export const snapshotSchema = z.object({ format: z.literal("uttumak-backup"), version: z.literal(1), createdAt: z.string(), userId: z.string().uuid(), data: z.object(dataShape).strict() });
export type BackupSnapshot = z.infer<typeof snapshotSchema>;
export interface BackupFile { path: string; bytes: number; sha256: string; mime?: string }
export interface BackupManifest { format: "uttumak-backup"; version: 1; createdAt: string; photosIncluded: boolean; stickersIncluded: boolean; files: BackupFile[] }
export function safeBackupPath(path: string) {
  return Boolean(path) && !path.startsWith("/") && !/[\\:\u0000-\u001f]/.test(path) && path.split("/").every(part=>part && part !== "." && part !== "..");
}
export async function backupHash(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
}
export function parseManifest(value: unknown): BackupManifest {
  const result = z.object({ format:z.literal("uttumak-backup"),version:z.literal(1),createdAt:z.string(),photosIncluded:z.boolean(),stickersIncluded:z.boolean(),files:z.array(z.object({path:z.string().refine(safeBackupPath),bytes:z.number().int().nonnegative(),sha256:z.string().regex(/^[a-f0-9]{64}$/),mime:z.string().optional()})) }).parse(value);
  if (new Set(result.files.map(f=>f.path)).size !== result.files.length) throw new Error("백업에 중복 파일 경로가 있습니다.");
  return result;
}
const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));
const fileUrl = (path: string) => escapeHtml(path.split("/").map(encodeURIComponent).join("/"));
export function validateBackupCoverage(manifest: BackupManifest, snapshot: BackupSnapshot) {
  const paths = new Set(manifest.files.map(file => file.path));
  if (!paths.has("backup.json")) throw new Error("백업 데이터가 검증 목록에 없습니다.");
  if (manifest.photosIncluded) for (const photo of snapshot.data.visit_photos.filter(p => p.upload_state !== "pending")) {
    if (!safeBackupPath(String(photo.storage_path)) || !paths.has("photos/" + photo.storage_path)) throw new Error("사진 원본이 빠졌어요: " + photo.storage_path);
  }
}
export function offlineBackupHtml(snapshot: BackupSnapshot, photosIncluded: boolean) {
  const data = snapshot.data;
  const profileNames = new Map(data.profiles.map(p=>[p.id,p.display_name]));
  const parts = data.groups.map(group=>{
    const visits = data.visits.filter(v=>v.group_id === group.id).map(visit=>{
      const place = data.places.find(p=>p.id === visit.place_id);
      const photos = photosIncluded ? data.visit_photos.filter(p=>p.visit_id===visit.id && p.upload_state!=="pending").map(p=>safeBackupPath(String(p.storage_path)) ? `<img loading="lazy" src="${fileUrl("photos/"+p.storage_path)}" alt="기록 사진">` : "").join("") : "";
      const comments = data.visit_comments.filter(c=>c.visit_id===visit.id).map(c=>`<li><strong>${escapeHtml(profileNames.get(c.author_id))}</strong> <small>${escapeHtml(c.created_at)}</small><p>${escapeHtml(c.body)}</p>${c.sticker_id && safeBackupPath(String(c.sticker_id)) ? `<img class="sticker" src="${fileUrl("stickers/"+c.sticker_id)}" alt="${escapeHtml(c.sticker_id)}">` : ""}</li>`).join("");
      return `<article><h3>${escapeHtml(visit.title)} ${visit.deleted_at ? "(휴지통)" : ""}</h3><p>${escapeHtml(visit.visited_on)} · ${escapeHtml(place?.name)} · ${escapeHtml(place?.address)}</p><p>${escapeHtml(visit.note)}</p><p>${escapeHtml((visit.tags as unknown[] ?? []).join(", "))}</p><div class="photos">${photos}</div><ul>${comments}</ul></article>`;
    }).join("");
    const trips = data.trips.filter(t=>t.group_id===group.id).map(trip=>`<article><h3>여행: ${escapeHtml(trip.name)}</h3><p>${escapeHtml(trip.start_date)} ~ ${escapeHtml(trip.end_date)}</p><ul>${data.schedule_items.filter(i=>i.trip_id===trip.id).map(i=>`<li><strong>${escapeHtml(i.title)}</strong> · ${escapeHtml(data.places.find(p=>p.id===i.place_id)?.name)}<p>${escapeHtml(i.starts_at)} ~ ${escapeHtml(i.ends_at)}</p><p>${escapeHtml(i.note)}</p></li>`).join("")}</ul></article>`).join("");
    return `<section><h2>${escapeHtml(group.name)}</h2>${visits}${trips}</section>`;
  }).join("");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>우뚜막 백업 기록</title><style>body{max-width:900px;margin:32px auto;padding:0 20px;font-family:system-ui;line-height:1.7}article{border:1px solid #ddd;border-radius:12px;padding:20px;margin:16px 0}p{white-space:pre-wrap;overflow-wrap:anywhere}.photos{display:flex;flex-wrap:wrap;gap:8px}.photos img{width:240px;max-width:100%;height:180px;object-fit:contain}.sticker{max-width:128px}small{color:#666}</style><h1>우뚜막 · 소중한 기록</h1><p>백업 시각: ${escapeHtml(snapshot.createdAt)}</p>${parts}</html>`;
}
