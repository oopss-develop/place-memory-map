import { expect, it } from "vitest";
import { quickFilterValue } from "./journal-delight";
import { EMPTY_FILTERS } from "./visit-filter";
it("does not label complex tag and status filters as all", () => {
  const options = ["전체", "방문 예정", "산책"];
  expect(quickFilterValue(EMPTY_FILTERS, options)).toBe("전체");
  expect(quickFilterValue({ ...EMPTY_FILTERS, status: "planned" }, options)).toBe("방문 예정");
  expect(quickFilterValue({ ...EMPTY_FILTERS, tags: ["산책"] }, options)).toBe("산책");
  for (const filters of [{ ...EMPTY_FILTERS, tags: ["산책", "데이트"] }, { ...EMPTY_FILTERS, status: "visited" as const }, { ...EMPTY_FILTERS, tags: ["다른 태그"] }, { ...EMPTY_FILTERS, status: "planned" as const, tags: ["산책"] }]) expect(quickFilterValue(filters, options)).toBe("");
});
