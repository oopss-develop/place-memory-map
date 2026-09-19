import { describe, expect, it } from "vitest";
import { MARKER_PICKER_STYLE_IDS, markerSvgDataUrl } from "@/lib/marker-styles";
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
  it("uses a round black marker by default", () => expect(visitSchema.parse(validVisit).markerStyle).toBe("black-9"));
  it("marks new visits as completed by default", () => expect(visitSchema.parse(validVisit).isPlanned).toBe(false));
  it("accepts a planned visit", () => expect(visitSchema.parse({ ...validVisit, isPlanned: true }).isPlanned).toBe(true));
  it("accepts a supported marker", () => expect(visitSchema.parse({ ...validVisit, markerStyle: "round-gamepad-black" }).markerStyle).toBe("round-gamepad-black"));
  it("shows only round pins in the picker", () => {
    expect(MARKER_PICKER_STYLE_IDS).toHaveLength(38);
    expect(MARKER_PICKER_STYLE_IDS.every((style) => markerSvgDataUrl(style).endsWith("-round.png"))).toBe(true);
  });
  it("still accepts previously saved square pins", () => expect(visitSchema.parse({ ...validVisit, markerStyle: "square-camp-color" }).markerStyle).toBe("square-camp-color"));
  it("rejects an unknown marker", () => expect(visitSchema.safeParse({ ...validVisit, markerStyle: "unknown" }).success).toBe(false));
  it("accepts half-point ratings", () => expect(visitSchema.safeParse({ ...validVisit, rating: 4.5 }).success).toBe(true));
  it("rejects ratings above five", () => expect(visitSchema.safeParse({ ...validVisit, rating: 5.5 }).success).toBe(false));
  it("rejects ratings outside half-point steps", () => expect(visitSchema.safeParse({ ...validVisit, rating: 4.25 }).success).toBe(false));
  it("rejects more than eight tags", () => expect(visitSchema.safeParse({ ...validVisit, tags: Array.from({ length: 9 }, (_, index) => `tag-${index}`) }).success).toBe(false));
});

describe("placeSearchSchema", () => {
  it("requires at least two characters", () => expect(placeSearchSchema.safeParse({ q: "서" }).success).toBe(false));
});
