import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { localPlaceResults, usePlaceSearch } from "./use-place-search";
import type { Visit } from "@/types/domain";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("ignores an old provider response even when the transport ignores abort", async () => {
  let finish!: (response: Response) => void;
  const fetchMock = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetchMock);
  const { result, rerender } = renderHook(({ provider }) => usePlaceSearch("서울", provider, "group", []), { initialProps: { provider: "kakao" as "kakao" | "osm" } });
  await act(async () => { void result.current.search(); });
  const signal = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  rerender({ provider: "osm" });
  expect((signal[1].signal as AbortSignal).aborted).toBe(true);
  await act(async () => { finish(Response.json({ results: [{ id: "old" }] })); });
  await waitFor(() => expect(result.current.results).toEqual([]));
});

it("limits fallback records to the current map, excludes trash and preserves place identity", () => {
  const place = { id: "place", provider: "manual" as const, name: "서울 숲", address: "서울", category: "산책", latitude: 37, longitude: 127 };
  const visit = { id: "visit", groupId: "current", place } as Visit;
  const results = localPlaceResults([visit, { ...visit, id: "trash", deletedAt: "2026-10-07" }, { ...visit, groupId: "other" }, visit], "current", "서울");
  expect(results).toHaveLength(1);
  expect(results[0].existingPlace).toBe(place);
});
