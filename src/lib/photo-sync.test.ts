import { describe, expect, it } from "vitest";
import { preservePhotoUrls } from "./photo-sync";
import type { Visit } from "@/types/domain";

const now = Date.UTC(2026, 9, 2);
const signed = (expiresIn: number) => `https://example.test/storage/v1/object/sign/visit-photos/photo.webp?token=h.${btoa(JSON.stringify({ exp: (now + expiresIn) / 1000 }))}.s`;
const record: Visit = {
  id: "visit", groupId: "group", place: { id: "place", provider: "manual", name: "장소", address: "", category: "", latitude: 37, longitude: 127 },
  visitedOn: "2026-10-02", isPlanned: false, title: "기록", note: "", rating: 5, tags: [], participants: [],
  photoIds: ["p1", "p2"], photoUrls: [signed(3_600_000), signed(3_500_000)], markerStyle: "black-9", version: 1, updatedBy: "나",
};
describe("photo synchronization", () => {
  it("keeps valid image URLs across polling and record edits", () => {
    const updated = { ...record, version: 2, title: "수정됨", photoUrls: [signed(3_610_000), signed(3_510_000)] };
    const [result] = preservePhotoUrls([record], [updated], now);
    expect(result.photoUrls).toEqual(record.photoUrls);
    expect(result.title).toBe("수정됨");
    expect(result.version).toBe(2);
  });
  it("matches photo IDs after deletion, reordering and new uploads", () => {
    const incoming = { ...record, photoIds: ["p2", "p3"], photoUrls: [signed(3_610_000), signed(3_620_000)] };
    const [result] = preservePhotoUrls([record], [incoming], now);
    expect(result.photoIds).toEqual(["p2", "p3"]);
    expect(result.photoUrls).toEqual([record.photoUrls[1], incoming.photoUrls[1]]);
    expect(preservePhotoUrls([record], [], now)).toEqual([]);
  });
  it("refreshes expired, nearly expired and invalid URLs", () => {
    for (const oldUrl of [signed(-1), signed(59_000), "https://example.test/invalid?token=bad", "data:image/png;base64,test"]) {
      const previous = { ...record, photoUrls: [oldUrl], photoIds: ["p1"] };
      const incoming = { ...previous, photoUrls: [signed(3_600_000)] };
      expect(preservePhotoUrls([previous], [incoming], now)[0].photoUrls).toEqual(incoming.photoUrls);
    }
  });
  it("does not reuse URLs from another record or map, or assume IDs by index", () => {
    for (const incoming of [{ ...record, id: "other" }, { ...record, groupId: "other" }, { ...record, photoIds: undefined }]) {
      const updated = { ...incoming, photoUrls: [signed(3_610_000)] };
      expect(preservePhotoUrls([record], [updated], now)[0].photoUrls).toEqual(updated.photoUrls);
    }
  });
});
