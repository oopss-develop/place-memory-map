import type { Group, Profile, Visit } from "@/types/domain";

export const demoMembers: Profile[] = [
  { id: "11111111-1111-4111-8111-111111111111", displayName: "이교혁", initials: "이" },
  { id: "22222222-2222-4222-8222-222222222222", displayName: "박나린", initials: "박" },
  { id: "33333333-3333-4333-8333-333333333333", displayName: "박우성", initials: "박" },
  { id: "44444444-4444-4444-8444-444444444444", displayName: "이은지", initials: "이" },
];

export const demoGroups: Group[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "우리 넷의 지도", role: "owner", memberCount: 4 },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "주말 탐험대", role: "member", memberCount: 5 },
];

export const demoVisits: Visit[] = [
  {
    id: "44444444-4444-4444-8444-444444444444",
    groupId: demoGroups[0].id,
    place: {
      id: "77777777-7777-4777-8777-777777777777",
      provider: "kakao",
      providerPlaceId: "demo-001",
      name: "서촌 작은 식탁",
      address: "서울 종로구 자하문로7길",
      category: "음식점 · 한식",
      latitude: 37.5786,
      longitude: 126.9723,
    },
    visitedOn: "2026-08-23",
    title: "비 오기 전, 늦은 점심",
    note: "창가에 앉아 들깨 수제비를 나눠 먹었다. 다음에는 저녁 메뉴가 시작될 때 다시 오기로 했다.",
    rating: 5,
    tags: ["비 오는 날", "데이트", "다시 갈 곳"],
    participants: demoMembers.slice(0, 2),
    photoUrls: ["https://images.unsplash.com/photo-1445116572660-236099ec97a0?auto=format&fit=crop&w=1200&q=85"],
    version: 2,
    updatedBy: "서연",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    groupId: demoGroups[0].id,
    place: {
      id: "88888888-8888-4888-8888-888888888888",
      provider: "kakao",
      providerPlaceId: "demo-002",
      name: "서울숲 유리온실",
      address: "서울 성동구 뚝섬로 273",
      category: "관광명소 · 공원",
      latitude: 37.5444,
      longitude: 127.0374,
    },
    visitedOn: "2026-07-12",
    title: "한낮의 초록",
    note: "사람이 적은 동쪽 길로 오래 걸었다. 온실 앞 벤치가 오늘의 가장 좋은 자리였다.",
    rating: 4,
    tags: ["산책", "여름"],
    participants: demoMembers.slice(0, 2),
    photoUrls: [],
    version: 1,
    updatedBy: "민준",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    groupId: demoGroups[0].id,
    place: {
      id: "99999999-9999-4999-8999-999999999999",
      provider: "manual",
      name: "을지로 골목 사진점",
      address: "서울 중구 충무로 일대",
      category: "직접 지정",
      latitude: 37.5661,
      longitude: 126.9915,
    },
    visitedOn: "2026-05-03",
    title: "필름 한 롤을 다 쓴 날",
    note: "간판과 오래된 창문을 찍으며 골목을 세 바퀴 돌았다.",
    rating: 5,
    tags: ["사진", "골목"],
    participants: demoMembers.slice(0, 2),
    photoUrls: [],
    version: 1,
    updatedBy: "민준",
  },
];
