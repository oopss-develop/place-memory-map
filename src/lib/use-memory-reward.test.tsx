import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { useMemoryReward } from "./use-memory-reward";
beforeEach(() => sessionStorage.clear());
it("waits for completion and deduplicates a confirmed request across remounts", () => {
  const { result, unmount } = renderHook(() => useMemoryReward("user"));
  act(() => { expect(result.current.complete()).toBe(false); });
  result.current.pending.current = { requestId: "request", visitId: "visit", groupId: "map" };
  expect(result.current.reward).toBeUndefined();
  act(() => { expect(result.current.complete()).toBe(true); });
  expect(result.current.reward?.visitId).toBe("visit");
  unmount();
  const next = renderHook(() => useMemoryReward("user"));
  next.result.current.pending.current = { requestId: "request", visitId: "visit", groupId: "map" };
  act(() => { expect(next.result.current.complete()).toBe(false); });
  expect(next.result.current.reward).toBeUndefined();
});
