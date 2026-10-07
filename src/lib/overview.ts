import type { Group, Trip, Visit } from "@/types/domain";

export type OverviewPeriod = "all" | "year" | "month";
export interface OverviewVisit {
  id: string; groupId: string; placeId: string; placeName: string; title: string; visitedOn: string; isPlanned: boolean; deletedAt?: string | null; tags: string[];
  photos: Array<{ id: string; deletedAt?: string | null; state?: string; path?: string; url?: string; order?: number }>;
}
export interface OverviewData {
  groups: Group[]; groupId?: string; period: OverviewPeriod; today: string;
  totals: { places: number; visits: number; photos: number | null };
  activity: Array<{ date: string; label: string; count: number }>;
  activityLabel: string;
  tags: Array<{ name: string; count: number }>;
  recentVisits: Array<{ id: string; groupId: string; groupName: string; placeName: string; title: string; visitedOn: string; photoUrl?: string }>;
  upcomingTrips: Array<Trip & { groupName: string; ongoing: boolean }>;
  photoWarning?: string;
}
export function dateInZone(now: Date, timeZone = "Asia/Seoul") {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (name: string) => parts.find(part => part.type === name)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
export function completedPhotos(visit: OverviewVisit) {
  return visit.photos.filter(photo => !photo.deletedAt && (!photo.state || photo.state === "complete")).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
}
export function overviewVisit(visit: Visit): OverviewVisit {
  return { id: visit.id, groupId: visit.groupId, placeId: visit.place.id, placeName: visit.place.name, title: visit.title, visitedOn: visit.visitedOn, isPlanned: visit.isPlanned, deletedAt: visit.deletedAt, tags: visit.tags, photos: visit.photoUrls.map((url, index) => ({ id: visit.photoIds?.[index] ?? `${visit.id}:${index}`, url, order: index })) };
}
export function aggregateOverview(groups: Group[], visits: OverviewVisit[], trips: Array<Trip & { deletedAt?: string | null }>, period: OverviewPeriod, groupId?: string, now = new Date(), recentLimit = 6): OverviewData {
  const today = dateInZone(now);
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  const allowed = new Set(groups.map(group => group.id));
  const names = new Map(groups.map(group => [group.id, group.name]));
  const inScope = (id: string) => allowed.has(id) && (!groupId || id === groupId);
  const included = visits.filter(visit => inScope(visit.groupId) && !visit.isPlanned && !visit.deletedAt && (period === "all" || visit.visitedOn.startsWith(period === "year" ? today.slice(0, 4) : today.slice(0, 7))));
  const counts = new Map<string, number>();
  const tags = new Map<string, number>();
  for (const visit of included) {
    const date = period === "month" ? visit.visitedOn : visit.visitedOn.slice(0, 7);
    counts.set(date, (counts.get(date) ?? 0) + 1);
    for (const tag of new Set(visit.tags)) tags.set(tag, (tags.get(tag) ?? 0) + 1);
  }
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const activity = Array.from({ length: period === "month" ? days : 12 }, (_, index) => {
    const date = period === "month" ? `${today.slice(0, 7)}-${String(index + 1).padStart(2, "0")}` : new Date(Date.UTC(year, period === "year" ? index : month - 12 + index, 1)).toISOString().slice(0, 7);
    return { date, label: period === "month" ? `${index + 1}일` : `${Number(date.slice(5, 7))}월`, count: counts.get(date) ?? 0 };
  });
  const recentVisits = [...included].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn) || a.id.localeCompare(b.id)).slice(0, recentLimit).map(visit => ({ id: visit.id, groupId: visit.groupId, groupName: names.get(visit.groupId)!, placeName: visit.placeName, title: visit.title, visitedOn: visit.visitedOn, photoUrl: completedPhotos(visit)[0]?.url }));
  const upcomingTrips = trips.filter(trip => inScope(trip.groupId) && !trip.deletedAt).flatMap(trip => {
    let localToday: string;
    try { localToday = dateInZone(now, trip.timeZone); } catch { localToday = today; }
    return trip.endDate >= localToday ? [{ ...trip, groupName: names.get(trip.groupId)!, ongoing: trip.startDate <= localToday }] : [];
  }).sort((a, b) => Number(b.ongoing) - Number(a.ongoing) || a.startDate.localeCompare(b.startDate) || a.id.localeCompare(b.id)).slice(0, 3);
  return { groups, groupId, period, today, totals: { places: new Set(included.map(visit => `${visit.groupId}:${visit.placeId}`)).size, visits: included.length, photos: included.reduce((sum, visit) => sum + completedPhotos(visit).length, 0) }, activity, activityLabel: period === "all" ? "최근 12개월" : period === "year" ? `${year}년 월별 방문` : `${year}년 ${month}월 일별 방문`, tags: [...tags].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5), recentVisits, upcomingTrips };
}
