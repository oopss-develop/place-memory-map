import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { demoGroups, demoMembers, demoVisits } from "@/lib/demo-data";
import { normalizeMarkerStyle, type MarkerStyle } from "@/lib/marker-styles";
import { getMemberInitials } from "@/lib/member-initials";
import type { Group, Profile, Visit } from "@/types/domain";
export interface DashboardData { groups: Group[]; members: Profile[]; visits: Visit[]; demoMode: boolean; activeGroupId?: string; photoWarning?: string; etag?: string; }
interface MembershipRow { role: "owner" | "member"; groups: { id: string; name: string; created_by: string }; }
interface MemberRow { group_id: string; profiles: { id: string; display_name: string }; }
interface VisitRow {
  id: string; group_id: string; visited_on: string; is_planned: boolean | null; title: string; note: string; rating: number; tags: string[]; marker_style: MarkerStyle | null; version: number;
  places: { id: string; provider: "kakao" | "manual"; provider_place_id: string | null; name: string; address: string; category: string; latitude: number | string; longitude: number | string };
  visit_participants: Array<{ profiles: { id: string; display_name: string } }>;
  visit_photos: Array<{ id: string; deleted_at?: string | null; upload_state?: string; storage_path: string; sort_order: number }>;
}


export async function readPages<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[]> {
 const rows: T[]=[];
 for(let offset=0;;offset+=250){ const {data,error}=await query(offset,offset+249); if(error) throw error; rows.push(...(data??[]) as T[]); if(!data || data.length<250) return rows; }
}
export async function loadDashboardSnapshot(db:SupabaseClient,userId:string,requestedGroupId?:string){
 const memberships=await readPages<MembershipRow>((from,to)=>db.from("group_members").select("role,groups(id,name,created_by)").eq("user_id",userId).order("group_id").range(from,to));
 const groups:Group[]=memberships.map(row=>({id:row.groups.id,name:row.groups.name,role:row.role,memberCount:0,ownerId:row.groups.created_by,visitCount:0}));
 const counts=await readPages<{group_id:string;visit_count:number;member_count:number}>((from,to)=>db.rpc("dashboard_group_counts").order("group_id").range(from,to));
 for(const group of groups){const count=counts.find(row=>row.group_id===group.id);group.memberCount=Number(count?.member_count??0);group.visitCount=Number(count?.visit_count??0);}
 const groupId=groups.some(group=>group.id===requestedGroupId)?requestedGroupId:groups[0]?.id;
 if(requestedGroupId && !groups.some(group=>group.id===requestedGroupId)) throw Object.assign(new Error("이 지도의 접근 권한이 없어졌습니다."),{status:403});
 const [memberRows,rows]=groupId ? await Promise.all([
 readPages<MemberRow>((from,to)=>db.from("group_members").select("group_id,profiles(id,display_name)").eq("group_id",groupId).order("user_id").range(from,to)),
 readPages<VisitRow>((from,to)=>db.from("visits").select("*,places(*),visit_participants(profiles(id,display_name)),visit_photos(id,storage_path,sort_order,deleted_at,upload_state)").eq("group_id",groupId).is("deleted_at",null).order("visited_on",{ascending:false}).order("id").range(from,to))
 ]) : [[],[]];
 const members:Profile[]=memberRows.map(row=>({id:row.profiles.id,displayName:row.profiles.display_name,initials:getMemberInitials(row.profiles.display_name)}));
 const etag='"'+createHash("sha256").update(JSON.stringify({groups,members,rows})).digest("hex")+'"';
 return {groups,members,rows,activeGroupId:groupId,etag};
}
export async function materializeDashboard(db:SupabaseClient,snapshot:Awaited<ReturnType<typeof loadDashboardSnapshot>>):Promise<DashboardData>{
 const photos=snapshot.rows.flatMap(row=>(row.visit_photos??[]).filter(p=>!p.deleted_at&&p.upload_state!=="pending"));
 const links=new Map<string,string>();let failed=false;
 for(let offset=0;offset<photos.length;offset+=250){
  const batch=photos.slice(offset,offset+250);
  try{const {data,error}=await db.storage.from("visit-photos").createSignedUrls(batch.map(photo=>photo.storage_path),3600);if(error)failed=true;for(const [index,photo] of batch.entries()){const url=data?.[index]?.signedUrl;if(url)links.set(photo.id,url);else failed=true;}}catch{failed=true;}
 }
 const visits=snapshot.rows.map(row=>{
 const signed=(row.visit_photos??[]).filter(photo=>links.has(photo.id)).sort((a,b)=>a.sort_order-b.sort_order).map(photo=>({id:photo.id,url:links.get(photo.id)}));
      return {
        id: row.id,
        groupId: row.group_id,
        place: {
          id: row.places.id,
          provider: row.places.provider,
          providerPlaceId: row.places.provider_place_id ?? undefined,
          name: row.places.name,
          address: row.places.address ?? "",
          category: row.places.category ?? "직접 지정",
          latitude: Number(row.places.latitude),
          longitude: Number(row.places.longitude),
        },
        visitedOn: row.visited_on,
        isPlanned: row.is_planned ?? false,
        title: row.title,
        note: row.note ?? "",
        rating: row.rating,
        tags: row.tags ?? [],
        participants: (row.visit_participants ?? []).map((p) => ({
          id: p.profiles.id,
          displayName: p.profiles.display_name,
          initials: getMemberInitials(p.profiles.display_name),
        })),
        photoOrder: (row.visit_photos ?? []).filter(photo => !photo.deleted_at && photo.upload_state !== "pending").sort((a,b) => a.sort_order - b.sort_order).map(photo => photo.id),
        photoIds: signed.filter(photo => photo.url).map(photo => photo.id),
        photoUrls: signed.flatMap(photo => photo.url ? [photo.url] : []),
        markerStyle: normalizeMarkerStyle(row.marker_style),
        version: row.version,
        updatedBy: "그룹 멤버",
      } satisfies Visit;
 });
 return {groups:snapshot.groups,members:snapshot.members,visits,demoMode:false,activeGroupId:snapshot.activeGroupId,etag:snapshot.etag,photoWarning:failed?"일부 사진을 불러오지 못했습니다. 다시 시도해 주세요.":undefined};
}
export async function getDashboardData(db?:SupabaseClient,userId?:string,groupId?:string):Promise<DashboardData>{
 if(!db||!userId)return {groups:demoGroups,members:demoMembers,visits:demoVisits,demoMode:true,activeGroupId:demoGroups[0]?.id};
 return materializeDashboard(db,await loadDashboardSnapshot(db,userId,groupId));
}
