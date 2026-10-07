import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOverviewSnapshot, materializeOverview } from "./overview-server";

function database(photoError = false) {
  const membership = { role: "owner", groups: { id: "a", name: "지도", created_by: "user" } };
  const records = Array.from({ length: 1001 }, (_, index) => ({ id: `v${index}`, group_id: "a", place_id: "place", title: "방문", visited_on: "2026-10-01", is_planned: false, tags: ["산책"], version: 1, places: { name: "숲" } }));
  const photos = records.map(row => ({ id: row.id + "photo", visit_id: row.id, storage_path: row.id + ".jpg", sort_order: 0, upload_state: "complete", deleted_at: null }));
  const queries: Array<{ table: string; from: number; to: number }> = [];
  const sign = vi.fn(async (paths: string[]) => ({ data: paths.map((path, index) => ({ signedUrl: index ? undefined : path + "?signed" })), error: null }));
  const from = vi.fn((table: string) => {
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query), is: vi.fn(() => query), order: vi.fn(() => query), range: vi.fn(async (start: number, end: number) => {
      queries.push({ table, from: start, to: end });
      const rows = table === "group_members" ? [membership] : table === "visits" ? records : table === "visit_photos" ? photos : [];
      return { data: rows.slice(start, end + 1), error: photoError && table === "visit_photos" ? new Error("storage metadata failed") : null };
    }) };
    return query;
  });
  return { db: { from, storage: { from: () => ({ createSignedUrls: sign }) } } as unknown as SupabaseClient, queries, sign };
}
it("reads visits and photo metadata to the last page without reading schedules", async () => {
  const { db, queries, sign } = database();
  const snapshot = await loadOverviewSnapshot(db, "user", "all");
  expect(snapshot.data.totals).toEqual({ places: 1, visits: 1001, photos: 1001 });
  expect(queries.filter(query => query.table === "visits")).toHaveLength(5);
  expect(queries.filter(query => query.table === "visit_photos")).toHaveLength(5);
  expect(queries.every(query => query.to - query.from === 249)).toBe(true);
  expect(queries.some(query => query.table === "schedule_items")).toBe(false);
  expect(sign).not.toHaveBeenCalled();
  const data = await materializeOverview(db, snapshot);
  expect(sign).toHaveBeenCalledTimes(1); expect(sign.mock.calls[0][0]).toHaveLength(6);
  expect(data.recentVisits.filter(visit => visit.photoUrl)).toHaveLength(1);
  expect(data.photoWarning).toBeTruthy(); expect(data.totals).toEqual(snapshot.data.totals);
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
