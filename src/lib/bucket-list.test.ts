import { expect, it } from "vitest";
import { bucketSchema, bucketStatus } from "./bucket-list";
import type { BucketItem, Visit } from "@/types/domain";
const id = "10000000-0000-4000-8000-000000000001";
const input = { id, groupId: id, title: "서핑 배우기", kind: "activity", requestId: id };
it("accepts wishes without a date, location or rating, and validates optional locations", () => {
  expect(bucketSchema.parse(input).place).toBeNull();
  expect(bucketSchema.safeParse({ ...input, place: { provider: "manual", name: "해변", latitude: 37, longitude: 128 } }).success).toBe(true);
  expect(bucketSchema.safeParse({ ...input, place: { provider: "manual", name: "해변", latitude: 200, longitude: 128 } }).success).toBe(false);
  expect(bucketSchema.safeParse({ ...input, title: " " }).success).toBe(false);
});
it("derives status from live linked records, preserving wishes after deletion", () => {
  const item = { id, group_id: id, visit_id: id } as BucketItem;
  const visit = { id, groupId: id, isPlanned: true } as Visit;
  expect(bucketStatus(item, [])).toBe("wish");
  expect(bucketStatus(item, [visit])).toBe("planned");
  expect(bucketStatus(item, [{ ...visit, isPlanned: false }])).toBe("completed");
  expect(bucketStatus(item, [{ ...visit, deletedAt: "2026-10-26" }])).toBe("wish");
  expect(bucketStatus(item, [{ ...visit, groupId: "other" }])).toBe("wish");
});
