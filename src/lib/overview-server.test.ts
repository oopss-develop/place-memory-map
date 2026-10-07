import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOverviewSnapshot, materializeOverview } from "./overview-server";

function database(photoError = false, photosPerVisit = 1) {
  const membership = { role: "owner", groups: { id: "a", name: "지도", created_by: "user" } };
  const records = Array.from({ length: 1001 }, (_, index) => ({ id: `v${index}`, group_id: "a", place_id: "place", title: "방문", note: "첫 줄\n두 번째 줄", rating: 5, marker_style: "black-9", visited_on: "2026-10-01", is_planned: false, tags: ["산책"], version: 1, places: { id: "place", provider: "manual", name: "숲", address: "서울", latitude: 37, longitude: 127 }, visit_participants: [{ profiles: { id: "user", display_name: "여행자" } }] }));
  const photos = records.flatMap(row => Array.from({ length: photosPerVisit }, (_, index) => ({ id: row.id + "photo" + index, visit_id: row.id, storage_path: row.id + `-${index}.jpg`, sort_order: index, upload_state: "complete", deleted_at: null })));
  const queries: Array<{ table: string; from: number; to: number }> = [];
  const sign = vi.fn(async (paths: string[]) => ({ data: paths.map((path, index) => ({ signedUrl: index ? undefined : path + "?signed" })), error: null }));
  const from = vi.fn((table: string) => {
    let selectedIds: string[] | undefined;
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn((column: string, ids: string[]) => { if (column === "id") selectedIds = ids; return query; }), is: vi.fn(() => query), order: vi.fn(() => query), range: vi.fn(async (start: number, end: number) => {
      queries.push({ table, from: start, to: end });
      const rows = table === "group_members" ? [membership] : table === "visits" ? records.filter(row => !selectedIds || selectedIds.includes(row.id)) : table === "visit_photos" ? photos : [];
      return { data: rows.slice(start, end + 1), error: photoError && table === "visit_photos" ? new Error("storage metadata failed") : null };
    }) };
    return query;
  });
  return { db: { from, storage: { from: () => ({ createSignedUrls: sign }) } } as unknown as SupabaseClient, queries, sign, records };
}
it("reads visits and photo metadata to the last page without reading schedules", async () => {
  const { db, queries, sign } = database();
  const snapshot = await loadOverviewSnapshot(db, "user", "all");
  expect(snapshot.data.totals).toEqual({ places: 1, visits: 1001, photos: 1001 });
  expect(queries.filter(query => query.table === "visits")).toHaveLength(6);
  expect(queries.filter(query => query.table === "visit_photos")).toHaveLength(5);
  expect(queries.every(query => query.to - query.from === 249)).toBe(true);
  expect(queries.some(query => query.table === "schedule_items")).toBe(false);
  expect(sign).not.toHaveBeenCalled();
  const data = await materializeOverview(db, snapshot);
  expect(sign).toHaveBeenCalledTimes(1); expect(sign.mock.calls[0][0]).toHaveLength(6);
  expect(data.recentVisits.filter(visit => visit.photoUrl)).toHaveLength(1);
  expect(data.photoWarning).toBeTruthy(); expect(data.totals).toEqual(snapshot.data.totals);
  expect(data.recentVisits.every(recent => recent.visit?.note === "첫 줄\n두 번째 줄" && recent.visit.rating === 5 && recent.visit.participants[0].displayName === "여행자")).toBe(true);
  expect(data.recentVisits[0].visit?.photoUrls).toEqual([data.recentVisits[0].photoUrl]);
  expect((await loadOverviewSnapshot(db, "user", "all")).etag).toBe(snapshot.etag);
});
it("denies unlisted maps before reading any visits", async () => {
  const { db, queries } = database();
  await expect(loadOverviewSnapshot(db, "user", "all", "forbidden")).rejects.toMatchObject({ status: 403 });
  expect(queries).toHaveLength(1);
});
it("keeps visit statistics and reports unknown photo count when photo metadata fails", async () => {
  const { db } = database(true);
  const { data } = await loadOverviewSnapshot(db, "user", "all");
  expect(data.totals.visits).toBe(1001); expect(data.totals.photos).toBeNull(); expect(data.photoWarning).toBeTruthy();
});
it("prepares every photo of visible records in one batch and detects detail changes in ETag", async () => {
  const { db, sign, records } = database(false, 2);
  sign.mockImplementation(async paths => ({ data: paths.map(path => ({ signedUrl: path + "?signed" })), error: null }));
  const snapshot = await loadOverviewSnapshot(db, "user", "all");
  expect(snapshot.detailRows).toHaveLength(6);
  const data = await materializeOverview(db, snapshot);
  expect(sign.mock.calls[0][0]).toHaveLength(12);
  expect(data.recentVisits.every(recent => recent.visit?.photoUrls.length === 2 && recent.visit.photoIds?.length === 2)).toBe(true);
  expect(data.recentVisits[0].photoUrl).toBe(data.recentVisits[0].visit?.photoUrls[0]);
  records[0].visit_participants[0].profiles.display_name = "수정한 이름";
  expect((await loadOverviewSnapshot(db, "user", "all")).etag).not.toBe(snapshot.etag);
});
