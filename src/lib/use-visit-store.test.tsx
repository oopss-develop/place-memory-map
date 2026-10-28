import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useVisitStore } from "./use-visit-store";
import type { DashboardData } from "./data";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("applies automatic updates without loading and keeps explicit refresh visible", async () => {
  const initial: DashboardData = { groups: [], members: [], visits: [], demoMode: false, activeGroupId: "group" };
  let delayed = false;
  let release: (() => void) | undefined;
  const fetchMock = vi.fn(async () => {
    if (delayed) await new Promise<void>(resolve => { release = resolve; });
    return Response.json({ ...initial, photoWarning: delayed ? "사진 재시도" : "" });
  });
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useVisitStore(initial, "group", false));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(result.current.loading).toBe(false));
  delayed = true;
  act(() => window.dispatchEvent(new Event("focus")));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(result.current.loading).toBe(false);
  await act(async () => { release?.(); });
  expect(result.current.photoWarning).toBe("사진 재시도");
  let request: Promise<void>;
  act(() => { request = result.current.refresh(); });
  expect(result.current.loading).toBe(true);
  act(() => window.dispatchEvent(new Event("online")));
  expect(fetchMock).toHaveBeenCalledTimes(3);
  await act(async () => { release?.(); await request; });
  expect(result.current.loading).toBe(false);
});

it("reuses a server snapshot on mount and still refreshes on the next poll and focus", async () => {
  vi.useFakeTimers();
  const initial: DashboardData = { groups: [], members: [], visits: [], demoMode: false, activeGroupId: "group", etag: '"snapshot"' };
  const fetchMock = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 304 }));
  vi.stubGlobal("fetch", fetchMock);
  const { result } = renderHook(() => useVisitStore(initial, "group", false));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(result.current.loading).toBe(false);
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].headers).toEqual({ "If-None-Match": '"snapshot"' });
  await act(async () => { window.dispatchEvent(new Event("focus")); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("fetches switched groups and revalidates when returning to the original server group", async () => {
  vi.useFakeTimers();
  const initial: DashboardData = { groups: [], members: [], visits: [], demoMode: false, activeGroupId: "first", etag: '"snapshot"' };
  const fetchMock = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(async () => Response.json(initial));
  vi.stubGlobal("fetch", fetchMock);
  const { rerender } = renderHook(({ groupId }) => useVisitStore(initial, groupId, false), { initialProps: { groupId: "first" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(fetchMock).not.toHaveBeenCalled();
  rerender({ groupId: "second" });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain("groupId=second");
  rerender({ groupId: "first" });
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toContain("groupId=first");
});

it("retries incomplete server photos immediately without a conditional response", async () => {
  vi.useFakeTimers();
  const initial: DashboardData = { groups: [], members: [], visits: [], demoMode: false, activeGroupId: "group", etag: '"snapshot"', photoWarning: "사진 재시도" };
  const fetchMock = vi.fn<(url: string, options: RequestInit) => Promise<Response>>(async () => Response.json(initial));
  vi.stubGlobal("fetch", fetchMock);
  renderHook(() => useVisitStore(initial, "group", false));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].headers).toEqual({});
});
