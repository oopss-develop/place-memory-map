import { expect, it } from "vitest";
import { memoryCandidates, pickMemory, quickFilterValue } from "./journal-delight";
import { EMPTY_FILTERS } from "./visit-filter";
import type { Visit } from "@/types/domain";

const visit = { id: "one", groupId: "map", isPlanned: false } as Visit;
it("excludes other maps, deleted and planned visits from memories", () => {
  const visits = [visit, { ...visit, id: "two" }, { ...visit, groupId: "other" }, { ...visit, deletedAt: "2026-10-07" }, { ...visit, isPlanned: true }];
  expect(memoryCandidates(visits, "map").map(value => value.id)).toEqual(["one", "two"]);
  expect(pickMemory(visits, "map", "one", () => 0)?.id).toBe("two");
  expect(pickMemory([visit], "map", "one", () => 0)).toBe(visit);
  expect(pickMemory([], "map")).toBeUndefined();
});
it("does not label complex tag and status filters as all", () => {
  const options = ["전체", "방문 예정", "산책"];
  expect(quickFilterValue(EMPTY_FILTERS, options)).toBe("전체");
  expect(quickFilterValue({ ...EMPTY_FILTERS, status: "planned" }, options)).toBe("방문 예정");
  expect(quickFilterValue({ ...EMPTY_FILTERS, tags: ["산책"] }, options)).toBe("산책");
  for (const filters of [{ ...EMPTY_FILTERS, tags: ["산책", "데이트"] }, { ...EMPTY_FILTERS, status: "visited" as const }, { ...EMPTY_FILTERS, tags: ["다른 태그"] }, { ...EMPTY_FILTERS, status: "planned" as const, tags: ["산책"] }]) expect(quickFilterValue(filters, options)).toBe("");
});
