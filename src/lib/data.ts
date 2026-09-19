import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { demoGroups, demoMembers, demoVisits } from "@/lib/demo-data";
import { normalizeMarkerStyle, type MarkerStyle } from "@/lib/marker-styles";
import { getMemberInitials } from "@/lib/member-initials";
import type { Group, Profile, Visit } from "@/types/domain";

export interface DashboardData {
  groups: Group[];
  members: Profile[];
  visits: Visit[];
  demoMode: boolean;
}

interface MembershipRow { role: "owner" | "member"; groups: { id: string; name: string; created_by: string }; }
interface MemberRow { group_id: string; profiles: { id: string; display_name: string }; }
interface VisitRow {
  id: string; group_id: string; visited_on: string; is_planned: boolean | null; title: string; note: string; rating: number; tags: string[]; marker_style: MarkerStyle | null; version: number;
  places: { id: string; provider: "kakao" | "manual"; provider_place_id: string | null; name: string; address: string; category: string; latitude: number | string; longitude: number | string };
  visit_participants: Array<{ profiles: { id: string; display_name: string } }>;
  visit_photos: Array<{ storage_path: string; sort_order: number }>;
}

export async function getDashboardData(supabase?: SupabaseClient, userId?: string): Promise<DashboardData> {
  if (!supabase || !userId) {
    return { groups: demoGroups, members: demoMembers, visits: demoVisits, demoMode: true };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("group_members")
    .select("role, groups(id,name,created_by), profiles(id,display_name)")
    .eq("user_id", userId);

  if (membershipError) throw membershipError;
  const membershipRows = (memberships ?? []) as unknown as MembershipRow[];
  const groups: Group[] = membershipRows.map((row) => ({
    id: row.groups.id,
    name: row.groups.name,
    role: row.role,
    memberCount: 0,
    ownerId: row.groups.created_by,
  }));

  if (!groups.length) return { groups: [], members: [], visits: [], demoMode: false };

  const groupIds = groups.map((group) => group.id);
  const [{ data: memberRows }, { data: visitRows, error: visitError }] = await Promise.all([
    supabase
      .from("group_members")
      .select("group_id,profiles(id,display_name)")
      .in("group_id", groupIds),
    supabase
      .from("visits")
      .select("*, places(*), visit_participants(profiles(id,display_name)), visit_photos(storage_path,sort_order)")
      .in("group_id", groupIds)
      .is("deleted_at", null)
      .order("visited_on", { ascending: false }),
  ]);
  if (visitError) throw visitError;

  const typedMemberRows = (memberRows ?? []) as unknown as MemberRow[];
  const membersById = new Map<string, Profile>();
  typedMemberRows.forEach((row) => {
    membersById.set(row.profiles.id, {
      id: row.profiles.id,
      displayName: row.profiles.display_name,
      initials: getMemberInitials(row.profiles.display_name),
    });
  });
  const members = Array.from(membersById.values());

  const visits: Visit[] = await Promise.all(
    ((visitRows ?? []) as unknown as VisitRow[]).map(async (row) => {
      const signed = await Promise.all(
        (row.visit_photos ?? [])
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(async (photo) => {
            const { data } = await supabase.storage
              .from("visit-photos")
              .createSignedUrl(photo.storage_path, 3600);
            return data?.signedUrl;
          }),
      );
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
        photoUrls: signed.filter((url): url is string => Boolean(url)),
        markerStyle: normalizeMarkerStyle(row.marker_style),
        version: row.version,
        updatedBy: "그룹 멤버",
      } satisfies Visit;
    }),
  );

  const counts = new Map<string, number>();
  typedMemberRows.forEach((row) => counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1));
  groups.forEach((group) => { group.memberCount = counts.get(group.id) ?? 0; });
  return { groups, members, visits, demoMode: false };
}
