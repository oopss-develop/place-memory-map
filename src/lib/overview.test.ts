import { expect, it } from "vitest";
import { aggregateOverview, dateInZone, type OverviewVisit } from "./overview";
import type { Group, Trip } from "@/types/domain";
const groups: Group[] = [{ id: "a", name: "A", role: "owner", memberCount: 4 }, { id: "b", name: "B", role: "member", memberCount: 4 }];
const now = new Date("2026-10-01T00:00:00Z");
const visit: OverviewVisit = { id: "v", groupId: "a", placeId: "p", placeName: "숲", title: "방문", visitedOn: "2026-10-01", isPlanned: false, tags: ["산책", "산책", "데이트"], photos: [{ id: "1", state: "complete" }, { id: "2", state: "pending" }, { id: "3", deletedAt: "2026-10-01" }] };
const trip: Trip = { id: "t", groupId: "a", name: "여행", startDate: "2026-09-30", endDate: "2026-09-30", timeZone: "America/Los_Angeles", version: 1 };
it("counts completed visits, distinct saved places per map and completed live photos", () => {
  const data = aggregateOverview(groups, [visit, { ...visit, id: "2" }, { ...visit, id: "3", groupId: "b" }, { ...visit, isPlanned: true }, { ...visit, deletedAt: "2026-10-01" }, { ...visit, groupId: "forbidden" }], [], "all", undefined, now);
  expect(data.totals).toEqual({ places: 2, visits: 3, photos: 3 });
  expect(data.tags).toEqual([{ name: "데이트", count: 3 }, { name: "산책", count: 3 }]);
  expect(aggregateOverview(groups, [visit, { ...visit, groupId: "b" }], [], "all", "a", now).totals.visits).toBe(1);
});
it("uses Korean calendar boundaries, includes zero buckets and caps recent visits", () => {
  const boundary = new Date("2026-09-30T15:00:00Z");
  expect(dateInZone(boundary)).toBe("2026-10-01");
  const data = aggregateOverview(groups, [visit, { ...visit, visitedOn: "2026-09-30" }], [], "month", undefined, boundary);
  expect(data.totals.visits).toBe(1); expect(data.activity).toHaveLength(31);
  expect(data.activity[0].count).toBe(1); expect(data.activity[1].count).toBe(0);
  const all = aggregateOverview(groups, [visit], [], "all", undefined, now);
  expect(all.activity[0].date).toBe("2025-11"); expect(all.activity[11].date).toBe("2026-10");
  const year = aggregateOverview(groups, [visit, { ...visit, visitedOn: "2025-12-31" }], [], "year", undefined, now);
  expect(year.activity[0].date).toBe("2026-01"); expect(year.totals.visits).toBe(1);
});
it("preserves 1,001 records and counts repeated visits separately", () => {
  const data = aggregateOverview(groups, Array.from({ length: 1001 }, (_, index) => ({ ...visit, id: String(index) })), [], "all", undefined, now);
  expect(data.totals).toEqual({ places: 1, visits: 1001, photos: 1001 }); expect(data.recentVisits).toHaveLength(6);
  expect(data.tags[0].count).toBe(1001);
});
it("shows ongoing trips first using each trip's timezone, regardless of visit period", () => {
  const data = aggregateOverview(groups, [], [trip, { ...trip, id: "future", startDate: "2026-10-10", endDate: "2026-10-12" }, { ...trip, id: "past", timeZone: "Asia/Seoul" }, { ...trip, id: "deleted", deletedAt: "2026-10-01" }, { ...trip, groupId: "forbidden" }], "month", undefined, now);
  expect(data.upcomingTrips.map(value => value.id)).toEqual(["t", "future"]); expect(data.upcomingTrips[0].ongoing).toBe(true);
});
