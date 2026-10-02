import type { Visit } from "@/types/domain";
export interface VisitFilters { query: string; from: string; to: string; status: "all" | "planned" | "visited"; tags: string[]; participants: string[]; sort: "newest" | "oldest" | "rating" }
export const EMPTY_FILTERS: VisitFilters = { query: "", from: "", to: "", status: "all", tags: [], participants: [], sort: "newest" };
export function filterVisits(visits: Visit[], filters: VisitFilters) {
  const query = filters.query.trim().toLocaleLowerCase();
  return visits.filter(visit => !visit.deletedAt && (!query || [visit.place.name,visit.title,visit.note,visit.place.address].some(text => text.toLocaleLowerCase().includes(query))) && (!filters.from || visit.visitedOn>=filters.from) && (!filters.to || visit.visitedOn<=filters.to) && (filters.status==="all" || visit.isPlanned===(filters.status==="planned")) && (!filters.tags.length || filters.tags.some(tag => visit.tags.includes(tag))) && (!filters.participants.length || filters.participants.some(id => visit.participants.some(person => person.id===id)))).sort((a,b) => filters.sort==="rating" ? b.rating-a.rating || b.visitedOn.localeCompare(a.visitedOn) : filters.sort==="oldest" ? a.visitedOn.localeCompare(b.visitedOn) : b.visitedOn.localeCompare(a.visitedOn));
}
