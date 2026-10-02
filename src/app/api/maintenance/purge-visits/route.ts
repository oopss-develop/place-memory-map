import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Maintenance is not configured" }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: staleError } = await db.rpc("release_stale_photo_reservations");
  if (staleError) return NextResponse.json({ error: "사진 재시도 슬롯을 정리하지 못했습니다." },{status:503});
  const { data: claimed, error } = await db.rpc("claim_expired_visits");
  if (error) return NextResponse.json({ error: "Could not claim expired records" }, { status: 503 });
  let purged = 0; let failed = 0;
  for (const visit of claimed ?? []) {
    const { data: photos, error: readError } = await db.from("visit_photos").select("storage_path").eq("visit_id", visit.id);
    if (readError) { failed++; continue; }
    const paths = (photos ?? []).map(photo => photo.storage_path);
    if (paths.length && (await db.storage.from("visit-photos").remove(paths)).error) { failed++; continue; }
    const { error: deleteError } = await db.from("visits").delete().eq("id", visit.id).not("purge_started_at", "is", null);
    if (deleteError) failed++; else purged++;
  }
  const { data: removedPhotos, error: photosError } = await db.from("visit_photos").select("id,storage_path").lt("deleted_at", new Date(Date.now() - 30 * 86400000).toISOString()).limit(100);
  if (photosError) failed++;
  for (const photo of removedPhotos ?? []) {
    if ((await db.storage.from("visit-photos").remove([photo.storage_path])).error) { failed++; continue; }
    if ((await db.from("visit_photos").delete().eq("id", photo.id).not("deleted_at", "is", null)).error) failed++;
  }
  return NextResponse.json({ purged, failed }, { status: failed ? 503 : 200 });
}
