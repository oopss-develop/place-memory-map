import { describe, expect, it } from "vitest";
import { placeSearchSchema, visitSchema } from "@/lib/schemas";

const validVisit = {
  groupId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  place: { provider: "manual", name: "동네 산책길", address: "", category: "직접 지정", latitude: 37.5, longitude: 127 },
  visitedOn: "2026-09-15",
  title: "선선한 저녁",
  note: "천천히 걸었다.",
  rating: 5,
  tags: ["산책"],
  participantIds: ["11111111-1111-4111-8111-111111111111"],
  version: 1,
};

describe("visitSchema", () => {
  it("accepts a complete manual-pin visit", () => expect(visitSchema.safeParse(validVisit).success).toBe(true));
  it("uses the first marker when none is selected", () => expect(visitSchema.parse(validVisit).markerStyle).toBe("pin-1"));
  it("accepts a supported marker", () => expect(visitSchema.parse({ ...validVisit, markerStyle: "pin-4" }).markerStyle).toBe("pin-4"));
  it("rejects an unknown marker", () => expect(visitSchema.safeParse({ ...validVisit, markerStyle: "unknown" }).success).toBe(false));
  it("rejects more than five rating points", () => expect(visitSchema.safeParse({ ...validVisit, rating: 6 }).success).toBe(false));
  it("rejects more than eight tags", () => expect(visitSchema.safeParse({ ...validVisit, tags: Array.from({ length: 9 }, (_, index) => `tag-${index}`) }).success).toBe(false));
});

describe("placeSearchSchema", () => {
  it("requires at least two characters", () => expect(placeSearchSchema.safeParse({ q: "서" }).success).toBe(false));
});
