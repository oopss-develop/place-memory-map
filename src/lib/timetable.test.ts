import { describe, expect, it } from "vitest";
import { addDays, addMinutes, atMinute, daySegments, fitsTrip, scheduleSchema, shiftSchedule, snapMinutes, tripSchema } from "@/lib/timetable";
import type { ScheduleItem } from "@/types/domain";

const place = { id: "30000000-0000-4000-8000-000000000001", provider: "manual" as const, name: "테스트 장소", address: "", category: "직접 지정", latitude: 37.5, longitude: 127 };
const item = (id: string, startsAt: string, endsAt: string): ScheduleItem => ({ id, tripId: "trip", groupId: "group", startsAt, endsAt, title: id, note: "", place, markerStyle: "black-9", version: 1 });
describe("local travel clock", () => {
  it("snaps to quarter hours and crosses calendar/month boundaries", () => {
    expect(snapMinutes(23)).toBe(30);
    expect(snapMinutes(-23)).toBe(-30);
    expect(addMinutes("2026-09-30T23:45", 30)).toBe("2026-10-01T00:15");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(atMinute("2026-09-28", 1440)).toBe("2026-09-29T00:00");
  });
  it("keeps wall clock values even on DST transition days", () => {
    expect(addMinutes("2026-03-08T01:30", 60)).toBe("2026-03-08T02:30");
  });
  it("rejects normalized invalid dates and invalid time zones", () => {
    expect(scheduleSchema.safeParse({ ...item("bad", "2026-02-30T09:00", "2026-03-01T10:00"), id: undefined }).success).toBe(false);
    expect(tripSchema.safeParse({ groupId: place.id, name: "여행", startDate: "2026-09-28", endDate: "2026-09-29", timeZone: "Not/AZone" }).success).toBe(false);
  });
  it("moves duration intact and resizes just one endpoint", () => {
    const original = item("a", "2026-09-28T09:00", "2026-09-28T10:00");
    expect(shiftSchedule(original, "move", 35)).toMatchObject({ startsAt: "2026-09-28T09:30", endsAt: "2026-09-28T10:30" });
    expect(shiftSchedule(original, "start", -15)).toMatchObject({ startsAt: "2026-09-28T08:45", endsAt: original.endsAt });
    expect(shiftSchedule(original, "end", 15)).toMatchObject({ startsAt: original.startsAt, endsAt: "2026-09-28T10:15" });
  });
  it("allows last-day midnight but rejects beyond the trip and zero durations", () => {
    const trip = { startDate: "2026-09-28", endDate: "2026-09-28" };
    expect(fitsTrip(item("a", "2026-09-28T23:00", "2026-09-29T00:00"), trip)).toBe(true);
    expect(fitsTrip(item("a", "2026-09-28T23:00", "2026-09-29T00:15"), trip)).toBe(false);
    expect(fitsTrip(item("a", "2026-09-28T09:00", "2026-09-28T09:00"), trip)).toBe(false);
  });
});
describe("day layout", () => {
  it("splits overnight items without displaying an end-at-midnight on the next day", () => {
    const overnight = item("a", "2026-09-28T23:00", "2026-09-29T01:00");
    expect(daySegments([overnight], "2026-09-28")[0]).toMatchObject({ start: 1380, end: 1440 });
    expect(daySegments([overnight], "2026-09-29")[0]).toMatchObject({ start: 0, end: 60 });
    expect(daySegments([{ ...overnight, endsAt: "2026-09-29T00:00" }], "2026-09-29")).toEqual([]);
  });
  it("allocates lanes across connected overlaps and resets after the cluster", () => {
    const segments = daySegments([
      item("a", "2026-09-28T09:00", "2026-09-28T12:00"),
      item("b", "2026-09-28T09:30", "2026-09-28T10:00"),
      item("c", "2026-09-28T10:00", "2026-09-28T11:00"),
      item("d", "2026-09-28T12:00", "2026-09-28T13:00"),
    ], "2026-09-28");
    expect(segments.map(({ lane, lanes, order }) => [lane, lanes, order])).toEqual([[0, 2, 1], [1, 2, 2], [1, 2, 3], [0, 1, 4]]);
  });
});
