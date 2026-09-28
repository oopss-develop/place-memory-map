import { z } from "zod";
import { placeSchema } from "@/lib/schemas";
import { DEFAULT_MARKER_STYLE, MARKER_STYLE_IDS } from "@/lib/marker-styles";
import type { ScheduleItem, Trip } from "@/types/domain";

// UTC arithmetic is used only as a calendar calculator. These are wall-clock
// values, never instants converted to the viewer's device time zone.
export const localStamp = (value: string) => value.slice(0, 16);
export const calendarMs = (value: string) => Date.parse(`${localStamp(value)}:00Z`);
export const addMinutes = (value: string, minutes: number) => new Date(calendarMs(value) + minutes * 60000).toISOString().slice(0, 16);
export const addDays = (date: string, days: number) => addMinutes(`${date}T00:00`, days * 1440).slice(0, 10);
export const snapMinutes = (minutes: number) => Math.round(minutes / 15) * 15;
export const atMinute = (date: string, minute: number) => addMinutes(`${date}T00:00`, minute);
export function tripDates(trip: Pick<Trip, "startDate" | "endDate">) {
  const result: string[] = [];
  for (let day = trip.startDate; day <= trip.endDate; day = addDays(day, 1)) result.push(day);
  return result;
}
export function fitsTrip(item: Pick<ScheduleItem, "startsAt" | "endsAt">, trip: Pick<Trip, "startDate" | "endDate">) {
  return item.startsAt >= `${trip.startDate}T00:00` && localStamp(item.endsAt) <= `${addDays(trip.endDate, 1)}T00:00` && item.endsAt > item.startsAt;
}
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "날짜와 시간을 확인해 주세요.")
  .refine((value) => Number.isFinite(calendarMs(value)) && new Date(calendarMs(value)).toISOString().slice(0, 16) === value, "올바른 날짜와 시간을 입력해 주세요.");
export const tripSchema = z.object({
  id: z.string().uuid().optional(), groupId: z.string().uuid(),
  name: z.string().trim().min(1, "여행 이름을 입력해 주세요.").max(120),
  startDate: z.string().date(), endDate: z.string().date(),
  timeZone: z.string().max(100).default("Asia/Seoul").refine((value) => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "유효한 시간대를 선택해 주세요."),
  version: z.number().int().positive().default(1),
}).refine((value) => value.endDate >= value.startDate, "종료일은 시작일 이후여야 합니다.");
export const scheduleSchema = z.object({
  id: z.string().uuid().optional(), version: z.number().int().positive().default(1),
  place: placeSchema.extend({ id: z.string().uuid().optional() }),
  startsAt: localDateTime, endsAt: localDateTime,
  title: z.string().trim().min(1, "일정 제목을 입력해 주세요.").max(120),
  note: z.string().max(3000).default(""), markerStyle: z.enum(MARKER_STYLE_IDS).default(DEFAULT_MARKER_STYLE),
}).refine((value) => value.endsAt > value.startsAt, "종료 시간은 시작 시간 이후여야 합니다.");
export const deleteScheduleSchema = z.object({ id: z.string().uuid(), version: z.number().int().positive() });

export interface DaySegment { item: ScheduleItem; start: number; end: number; lane: number; lanes: number; order: number }
export function daySegments(items: ScheduleItem[], date: string): DaySegment[] {
  const start = calendarMs(`${date}T00:00`);
  const end = start + 86400000;
  const segments = items.filter((item) => calendarMs(item.startsAt) < end && calendarMs(item.endsAt) > start)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id))
    .map((item, index) => ({ item, start: Math.max(0, (calendarMs(item.startsAt) - start) / 60000), end: Math.min(1440, (calendarMs(item.endsAt) - start) / 60000), lane: 0, lanes: 1, order: index + 1 }));
  let cluster: DaySegment[] = [];
  let laneEnds: number[] = [];
  const flush = () => { cluster.forEach((segment) => { segment.lanes = laneEnds.length; }); cluster = []; laneEnds = []; };
  for (const segment of segments) {
    if (cluster.length && laneEnds.every((value) => value <= segment.start)) flush();
    let lane = laneEnds.findIndex((value) => value <= segment.start);
    if (lane < 0) lane = laneEnds.length;
    segment.lane = lane; laneEnds[lane] = segment.end; cluster.push(segment);
  }
  flush();
  return segments;
}
export function shiftSchedule(item: ScheduleItem, mode: "move" | "start" | "end", minutes: number) {
  const delta = snapMinutes(minutes);
  return { ...item, startsAt: mode === "end" ? item.startsAt : addMinutes(item.startsAt, delta), endsAt: mode === "start" ? item.endsAt : addMinutes(item.endsAt, delta) };
}
