import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useVisitStore } from "./use-visit-store";
import type { DashboardData } from "./data";

afterEach(() => vi.unstubAllGlobals());

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
