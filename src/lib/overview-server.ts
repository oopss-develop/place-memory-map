import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Group, Trip } from "@/types/domain";
import { readPages } from "./data";
import { aggregateOverview, completedPhotos, type OverviewPeriod, type OverviewVisit } from "./overview";
import { tripColumns } from "./trip-server";

interface Membership { role: Group["role"]; groups: { id: string; name: string; created_by: string } }
interface RecordRow {
  id: string; group_id: string; place_id: string; title: string; visited_on: string; is_planned: boolean; tags: string[]; version: number;
  places: { name: string };
}
interface PhotoRow { id: string; visit_id: string; storage_path: string; sort_order: number; deleted_at: string | null; upload_state: string }
export async function loadOverviewSnapshot(db: SupabaseClient, userId: string, period: OverviewPeriod, groupId?: string, now = new Date(), recentLimit = 6) {
  const memberships = await readPages<Membership>((from, to) => db.from("group_members").select("role,groups(id,name,created_by)").eq("user_id", userId).order("group_id").range(from, to));
  const groups: Group[] = memberships.map(row => ({ id: row.groups.id, name: row.groups.name, role: row.role, ownerId: row.groups.created_by, memberCount: 0 }));
  if (groupId && !groups.some(group => group.id === groupId)) throw Object.assign(new Error("이 지도의 접근 권한이 없습니다."), { status: 403 });
  const ids = groupId ? [groupId] : groups.map(group => group.id);
  const [rows, trips] = ids.length ? await Promise.all([
    readPages<RecordRow>((from, to) => db.from("visits").select("id,group_id,place_id,title,visited_on,is_planned,tags,version,places(name)").in("group_id", ids).is("deleted_at", null).eq("is_planned", false).order("id").range(from, to)),
    readPages<Trip>((from, to) => db.from("trips").select(tripColumns).in("group_id", ids).is("deleted_at", null).order("id").range(from, to)),
  ]) : [[], []];
  // Read photos independently: PostgREST embedded collections have their own row cap.
  let photos: PhotoRow[] = [], photoWarning: string | undefined;
  try { if (ids.length) photos = await readPages<PhotoRow>((from, to) => db.from("visit_photos").select("id,visit_id,storage_path,sort_order,deleted_at,upload_state,visits!inner(group_id,is_planned,deleted_at)").in("visits.group_id", ids).is("visits.deleted_at", null).eq("visits.is_planned", false).is("deleted_at", null).eq("upload_state", "complete").order("id").range(from, to)); }
  catch { photoWarning = "사진 정보를 불러오지 못해 사진 수와 미리보기를 표시할 수 없습니다. 방문 통계는 계속 확인할 수 있어요."; }
  const byVisit = new Map<string, PhotoRow[]>();
  for (const photo of photos) { const list = byVisit.get(photo.visit_id) ?? []; list.push(photo); byVisit.set(photo.visit_id, list); }
  const visits: OverviewVisit[] = rows.map(row => ({ id: row.id, groupId: row.group_id, placeId: row.place_id, placeName: row.places.name, title: row.title, visitedOn: row.visited_on, isPlanned: row.is_planned, tags: row.tags ?? [], photos: (byVisit.get(row.id) ?? []).map(photo => ({ id: photo.id, path: photo.storage_path, order: photo.sort_order, deletedAt: photo.deleted_at, state: photo.upload_state })) }));
  const data = aggregateOverview(groups, visits, trips, period, groupId, now, recentLimit);
  if (photoWarning) { data.photoWarning = photoWarning; data.totals.photos = null; }
  const etag = '"' + createHash("sha256").update(JSON.stringify({ data, rows, photos })).digest("hex") + '"';
  return { data, visits, etag };
}
export async function materializeOverview(db: SupabaseClient, snapshot: Awaited<ReturnType<typeof loadOverviewSnapshot>>) {
  const data = { ...snapshot.data, recentVisits: snapshot.data.recentVisits.map(visit => ({ ...visit })) };
  const byId = new Map(snapshot.visits.map(visit => [visit.id, visit]));
  const requests = data.recentVisits.flatMap(visit => { const record = byId.get(visit.id); const photo = record && completedPhotos(record)[0]; return photo?.path ? [{ visitId: visit.id, path: photo.path }] : []; });
  if (!requests.length) return data;
  let failed = false;
  for (let offset = 0; offset < requests.length; offset += 250) {
    const batch = requests.slice(offset, offset + 250);
    try {
      const { data: links, error } = await db.storage.from("visit-photos").createSignedUrls(batch.map(request => request.path), 3600);
      if (error) failed = true;
      batch.forEach((request, index) => { const url = links?.[index]?.signedUrl; if (!url) failed = true; else data.recentVisits.find(visit => visit.id === request.visitId)!.photoUrl = url; });
    } catch { failed = true; }
  }
  if (failed) data.photoWarning = "일부 사진을 불러오지 못했습니다. 통계와 기록은 계속 확인할 수 있어요.";
  return data;
}
