import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useTripStore } from "@/lib/use-trip-store";
const trip = { id: "trip", groupId: "group", name: "Test", startDate: "2026-09-28", endDate: "2026-09-30", timeZone: "Asia/Seoul", version: 1 };
const item = { id: "item", tripId: "trip", groupId: "group", place: { id: "place", name: "Place", address: "", category: "", latitude: 37, longitude: 127, provider: "manual" as const }, startsAt: "2026-09-28T09:00", endsAt: "2026-09-28T10:00", title: "Item", note: "", markerStyle: "black-9" as const, version: 1 };
afterEach(() => vi.unstubAllGlobals());
it("clears cached schedules when access is lost during the item request", async () => {
  let revoked = false;
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/items")) return revoked ? Response.json({ error: "권한 없음" }, { status: 403 }) : Response.json({ trip, items: [item] });
    return Response.json({ trips: [trip] });
  }));
  const { result } = renderHook(() => useTripStore("group", false));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.items).toHaveLength(1);
  revoked = true;
  await act(async () => { await expect(result.current.refresh()).rejects.toThrow("권한 없음"); });
  expect(result.current.items).toEqual([]);
  expect(result.current.trips).toEqual([]);
  expect(result.current.accessLost).toBe(true);
});
it("keeps the old schedule on a failed write and releases the saving lock", async () => {
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
    if (options.method !== "GET") return new Response(JSON.stringify({ error: "연결 오류" }), { status: 503 });
    return Response.json(_url.includes("/items") ? { trip, items: [item] } : { trips: [trip] });
  }));
  const { result } = renderHook(() => useTripStore("group", false));
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => { await expect(result.current.saveItem(trip, { ...item, endsAt: "2026-09-28T11:00" })).rejects.toThrow("연결 오류"); });
  expect(result.current.items[0].endsAt).toBe("2026-09-28T10:00");
  expect(result.current.busy).toBe(false);
});
it("refreshes the server version after a write conflict", async () => {
  let conflicted = false;
  vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
    if (options.method !== "GET") { conflicted = true; return new Response(JSON.stringify({ error: "충돌" }), { status: 409 }); }
    return Response.json(_url.includes("/items") ? { trip, items: [{ ...item, version: conflicted ? 2 : 1 }] } : { trips: [trip] });
  }));
  const { result } = renderHook(() => useTripStore("group", false));
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => { await expect(result.current.saveItem(trip, item)).rejects.toThrow("충돌"); });
  expect(result.current.items[0].version).toBe(2);
});

it("loads only the selected trip and keeps the same request ID after a lost response", async () => {
  const second = { ...trip, id: "second-trip" };
  let failed = false;
  const requests: string[] = [];
  const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
    if (options.method !== "GET") {
      requests.push(JSON.parse(String(options.body)).requestId);
      if (!failed) { failed = true; throw new Error("lost response"); }
      return Response.json({ trip: second, items: [item] });
    }
    return Response.json(url.includes("/items") ? { trip: second, items: [item] } : { trips: [trip, second] });
  });
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useTripStore("group", false, second.id));
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(fetchMock.mock.calls.filter(([url]) => url.includes("/items")).map(([url]) => url)).toEqual([`/api/trips/${second.id}/items`]);
  await act(async () => { await expect(result.current.saveItem(second, item)).rejects.toThrow("연결하지 못했습니다"); });
  await act(async () => { await result.current.saveItem(second, item); });
  expect(requests).toHaveLength(2);
  expect(requests[0]).toBe(requests[1]);
});
