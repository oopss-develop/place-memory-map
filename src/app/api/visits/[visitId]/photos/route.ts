import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getAccessWorkspaceUser } from "@/lib/access-workspace";
import { MAX_VISIT_IMAGE_BYTES } from "@/lib/images";
const uuid = z.string().uuid();
export async function POST(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params;
  if (!uuid.safeParse(visitId).success) return NextResponse.json({ error: "기록 ID를 확인해 주세요." }, { status: 400 });
  const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const form = await request.formData();
  const files = form.getAll("photos").filter((file): file is File => file instanceof File);
  let ids: string[];
  try { ids = JSON.parse(String(form.get("photoIds") ?? "null")) ?? files.map(() => crypto.randomUUID()); } catch { return NextResponse.json({ error: "사진 요청 정보를 확인해 주세요." }, { status: 400 }); }
  if (!files.length || files.length > 5 || !Array.isArray(ids) || ids.length !== files.length || ids.some(id => !uuid.safeParse(id).success) || new Set(ids).size !== ids.length || files.some(file => file.type !== "image/webp" || file.size > MAX_VISIT_IMAGE_BYTES)) return NextResponse.json({ error: "사진은 최대 5장, 압축된 WebP 350KB 이하로 올려주세요." }, { status: 400 });
  const results: Array<{ fileId: string; photoId?: string; url?: string; error?: string }> = [];
  for (const [index, file] of files.entries()) {
    const fileId = ids[index]; const bytes = Buffer.from(await file.arrayBuffer());
    const { data: photo, error: reserveError } = await auth.supabase.rpc("reserve_visit_photo", { target_id: visitId, file_id: fileId, file_hash: createHash("sha256").update(bytes).digest("hex") });
    if (reserveError || !photo) { results.push({ fileId, error: reserveError?.message ?? "사진을 준비하지 못했습니다." }); continue; }
    if (photo.upload_state !== "complete") {
      const { error: uploadError } = await auth.supabase.storage.from("visit-photos").upload(photo.storage_path, bytes, { contentType: "image/webp", upsert: false });
      if (uploadError && String(uploadError.statusCode) !== "409") { results.push({ fileId, photoId: photo.id, error: "사진 업로드에 실패했습니다. 다시 시도해 주세요." }); continue; }
      const { error: completeError } = await auth.supabase.rpc("complete_visit_photo", { target_id: visitId, file_id: fileId });
      if (completeError) { results.push({ fileId, photoId: photo.id, error: "사진 저장 확인에 실패했습니다. 다시 시도해 주세요." }); continue; }
    }
    const { data: signed, error: signError } = await auth.supabase.storage.from("visit-photos").createSignedUrl(photo.storage_path, 3600);
    results.push(signError || !signed?.signedUrl ? { fileId, photoId: photo.id, error: "사진 링크를 불러오지 못했습니다. 다시 시도해 주세요." } : { fileId, photoId: photo.id, url: signed?.signedUrl });
  }
  return NextResponse.json({ results, complete: results.every(item => !item.error), photoUrls: results.flatMap(item => item.url ? [item.url] : []) });
}
export async function DELETE(request: Request, context: { params: Promise<{ visitId: string }> }) {
  const { visitId } = await context.params; const auth = await getAccessWorkspaceUser();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const parsed = z.object({ photoId: uuid }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || !uuid.safeParse(visitId).success) return NextResponse.json({ error: "사진을 확인해 주세요." }, { status: 400 });
  const { data: visit } = await auth.supabase.from("visits").select("id").eq("id", visitId).is("deleted_at", null).maybeSingle();
  if (!visit) return NextResponse.json({ error: "접근할 수 없는 기록입니다." }, { status: 403 });
  const { data, error } = await auth.supabase.from("visit_photos").update({ deleted_at: new Date().toISOString() }).eq("id", parsed.data.photoId).eq("visit_id", visitId).is("deleted_at", null).select("id").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "사진을 삭제하지 못했습니다." }, { status: 409 });
  return NextResponse.json({ ok: true });
}
