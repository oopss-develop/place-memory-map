import { afterEach, describe, expect, it, vi } from "vitest";
import { exportRouteDescription, resolveExportRoute } from "./trip-export-route";
import type { ScheduleItem, TripRoute } from "@/types/domain";
const item = (id: string, date: string, longitude: number, hour = "09"): ScheduleItem => ({ id, tripId: "trip", groupId: "group", startsAt: `${date}T${hour}:00`, endsAt: `${date}T${hour}:30`, title: id, note: "", place: { id, provider: "manual", name: id, address: "", category: "", latitude: 33.4, longitude }, markerStyle: "black-9", version: 1 });
const road: TripRoute = { kind: "road", points: [{ latitude: 33.4, longitude: 126.3 }, { latitude: 33.45, longitude: 126.4 }, { latitude: 33.4, longitude: 126.5 }] };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("export routes for every day", () => {
  it("calculates road routes for each day without requiring a visible route", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ route: road }) }); vi.stubGlobal("fetch", request);
    const items = [item("a", "2026-10-23", 126.3), item("b", "2026-10-23", 126.5, "10"), item("c", "2026-10-24", 126.3), item("d", "2026-10-24", 126.5, "10")];
    for (const date of ["2026-10-23", "2026-10-24"]) expect(await resolveExportRoute("trip", items, date, "kakao", null)).toEqual(road);
    expect(request.mock.calls.map((call) => JSON.parse(call[1].body).date)).toEqual(["2026-10-23", "2026-10-24"]);
    expect(request.mock.calls[0][1].method).toBe("POST");
  });

  it("reuses a visible road route and skips empty or single-place days", async () => {
    const request = vi.fn(); vi.stubGlobal("fetch", request);
    const items = [item("a", "2026-10-23", 126.3), item("b", "2026-10-23", 126.5, "10")];
    expect(await resolveExportRoute("trip", items, "2026-10-23", "kakao", road)).toBe(road);
    expect(await resolveExportRoute("trip", items.slice(0, 1), "2026-10-23", "kakao", null)).toBeNull();
    expect(await resolveExportRoute("trip", items, "2026-10-24", "kakao", null)).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps chronological return visits and labels an unavailable road route as a connection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const items = [item("c", "2026-10-23", 126.3, "11"), item("a", "2026-10-23", 126.3), item("b", "2026-10-23", 126.5, "10"), { ...item("foreign", "2026-10-23", 129), tripId: "other" }];
    const route = await resolveExportRoute("trip", items, "2026-10-23", "kakao", null);
    expect(route?.kind).toBe("straight");
    expect(route?.points.map((point) => point.longitude)).toEqual([126.3, 126.5, 126.3]);
    expect(exportRouteDescription(route)).toContain("실제 도로 경로 아님");
    expect(exportRouteDescription(road)).toContain("굵은 실선");
  });

  it("does not request road routes for demo/overseas maps or accept an empty response route", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ route: { kind: "road", points: [] } }) }); vi.stubGlobal("fetch", request);
    const items = [item("a", "2026-10-23", 126.3), item("b", "2026-10-23", 126.5, "10")];
    expect((await resolveExportRoute("trip", items, "2026-10-23", "kakao", null, true))?.kind).toBe("straight");
    expect((await resolveExportRoute("trip", items, "2026-10-23", "osm", null))?.kind).toBe("straight");
    expect(request).not.toHaveBeenCalled();
    expect((await resolveExportRoute("trip", items, "2026-10-23", "kakao", null))?.kind).toBe("straight");
  });
});
