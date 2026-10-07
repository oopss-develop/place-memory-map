import type { Visit } from "@/types/domain";
import type { VisitFilters } from "./visit-filter";

export const MEMORY_QUESTIONS = ["가장 기억나는 순간은?", "함께 나눈 이야기는?", "다시 오고 싶은 이유는?"];
export function memoryCandidates(visits: Visit[], groupId: string) {
  return visits.filter(visit => visit.groupId === groupId && !visit.deletedAt && !visit.isPlanned);
}
export function pickMemory(visits: Visit[], groupId: string, previousId?: string, random = Math.random): Visit | undefined {
  const candidates = memoryCandidates(visits, groupId);
  const pool = candidates.length > 1 ? candidates.filter(visit => visit.id !== previousId) : candidates;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
export function quickFilterValue(filters: VisitFilters, options: string[]) {
  if (filters.status === "all" && !filters.tags.length) return "전체";
  if (filters.status === "planned" && !filters.tags.length) return "방문 예정";
  if (filters.status === "all" && filters.tags.length === 1 && options.includes(filters.tags[0])) return filters.tags[0];
  return "";
}
