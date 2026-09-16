import type { Group, Profile, Visit } from "@/types/domain";
import { getMemberInitials } from "@/lib/member-initials";

export const demoMembers: Profile[] = [
  { id: "11111111-1111-4111-8111-111111111111", displayName: "이교혁", initials: getMemberInitials("이교혁") },
  { id: "22222222-2222-4222-8222-222222222222", displayName: "박나린", initials: getMemberInitials("박나린") },
  { id: "33333333-3333-4333-8333-333333333333", displayName: "박우성", initials: getMemberInitials("박우성") },
  { id: "44444444-4444-4444-8444-444444444444", displayName: "이은지", initials: getMemberInitials("이은지") },
];

export const demoGroups: Group[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "또나우쥐", role: "owner", memberCount: 4, ownerId: "access-또" },
];

// 샘플 방문 기록은 비워 둡니다. 첫 기록은 사용자가 직접 추가합니다.
export const demoVisits: Visit[] = [];
