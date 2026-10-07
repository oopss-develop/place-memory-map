import type { VisitFilters } from "./visit-filter";

export function quickFilterValue(filters: VisitFilters, options: string[]) {
  if (filters.status === "all" && !filters.tags.length) return "전체";
  if (filters.status === "planned" && !filters.tags.length) return "방문 예정";
  if (filters.status === "all" && filters.tags.length === 1 && options.includes(filters.tags[0])) return filters.tags[0];
  return "";
}
