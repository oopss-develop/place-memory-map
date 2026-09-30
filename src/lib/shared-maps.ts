import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAllowedMembers } from "@/lib/access-auth";

export function createSharingAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("지도 자동 공유를 위해 SUPABASE_SERVICE_ROLE_KEY를 설정해 주세요.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getSharingMemberIds(admin: SupabaseClient): Promise<string[]> {
  const allowed = getAllowedMembers();
  if (allowed.length !== 4) throw new Error("자동 공유할 사용자 네 명을 먼저 등록해 주세요.");
  const emails = new Set(allowed.map((member) => member.email));
  const ids = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("지도를 공유할 사용자를 확인하지 못했습니다.");
    for (const user of data.users) {
      if (user.email && emails.has(user.email.trim().toLowerCase())) ids.add(user.id);
    }
    if (ids.size === emails.size || data.users.length < 1000) break;
  }
  // Accounts are created on first keyword login. Those members join on arrival.
  return [...ids];
}

async function shareMapsWithMembers(admin: SupabaseClient, groups: Array<{ id: string; created_by: string }>, memberIds: string[]) {
  if (groups.some((group) => !memberIds.includes(group.created_by))) throw new Error("등록된 사용자가 만든 지도만 자동 공유할 수 있습니다.");
  if (!groups.length) return;
  const { error } = await admin.from("group_members").upsert(
    groups.flatMap((group) => memberIds.map((userId) => ({ group_id: group.id, user_id: userId, role: userId === group.created_by ? "owner" : "member" }))),
    { onConflict: "group_id,user_id", ignoreDuplicates: true },
  );
  if (error) throw new Error("지도 공유 권한을 연결하지 못했습니다. 새로고침해 다시 시도해 주세요.");
}

export async function shareMapWithMembers(admin: SupabaseClient, groupId: string, ownerId: string, memberIds: string[]) {
  await shareMapsWithMembers(admin, [{ id: groupId, created_by: ownerId }], memberIds);
}

export async function synchronizeSharedMaps() {
  const admin = createSharingAdmin();
  const memberIds = await getSharingMemberIds(admin);
  if (!memberIds.length) return;
  for (let offset = 0; ; offset += 500) {
    const { data: groups, error } = await admin.from("groups").select("id,created_by").in("created_by", memberIds).order("id").range(offset, offset + 499);
    if (error) throw new Error("함께 볼 지도를 불러오지 못했습니다.");
    // Memberships enable existing RLS for records, photos, trips and schedules.
    await shareMapsWithMembers(admin, groups ?? [], memberIds);
    if (!groups || groups.length < 500) break;
  }
}
