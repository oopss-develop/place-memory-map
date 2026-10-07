import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Group, Trip } from "@/types/domain";
import { readPages, materializeDashboard, type VisitRow } from "./data";
import { aggregateOverview, type OverviewPeriod, type OverviewVisit } from "./overview";
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
  // Fetch full content only for the records already shown in the list.
  const detailRows: VisitRow[] = [];
  const recentIds = data.recentVisits.map(visit => visit.id);
  for (let offset = 0; offset < recentIds.length; offset += 250) {
    const batch = recentIds.slice(offset, offset + 250);
    const details = await readPages<VisitRow>((from, to) => db.from("visits").select("*,places(*),visit_participants(profiles(id,display_name))").in("id", batch).in("group_id", ids).is("deleted_at", null).eq("is_planned", false).order("id").range(from, to));
    detailRows.push(...details.map(row => ({ ...row, visit_photos: (byVisit.get(row.id) ?? []).map(photo => ({ ...photo })) })));
  }
  const found = new Set(detailRows.map(row => row.id));
  data.recentVisits = data.recentVisits.filter(visit => found.has(visit.id));
  if (photoWarning) { data.photoWarning = photoWarning; data.totals.photos = null; }
  const etag = '"' + createHash("sha256").update(JSON.stringify({ data, rows, photos, detailRows })).digest("hex") + '"';
  return { data, visits, detailRows, etag };
}
export async function materializeOverview(db: SupabaseClient, snapshot: Awaited<ReturnType<typeof loadOverviewSnapshot>>) {
  const details = await materializeDashboard(db, { groups: snapshot.data.groups, members: [], rows: snapshot.detailRows, activeGroupId: snapshot.data.groupId ?? "", etag: snapshot.etag });
  const byId = new Map(details.visits.map(visit => [visit.id, visit]));
  return { ...snapshot.data, photoWarning: snapshot.data.photoWarning ?? details.photoWarning, recentVisits: snapshot.data.recentVisits.map(recent => {
    const visit = byId.get(recent.id);
    return { ...recent, visit, photoUrl: visit?.photoUrls[0] };
  }) };
}
