import { expect, it, vi } from "vitest";
import { loadDashboardSnapshot, materializeDashboard, readPages, type VisitRow } from "./data";
import type { SupabaseClient } from "@supabase/supabase-js";

it("reads beyond the 1,000-row API limit without losing records", async () => {
  const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
  const query = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }));
  expect(await readPages(query)).toEqual(rows);
  expect(query).toHaveBeenCalledTimes(5);
});

it("does not return a misleading partial result when a later page fails", async () => {
  await expect(readPages(async (from) => ({ data: from ? null : Array.from({ length: 250 }, () => ({})), error: from ? new Error("read failed") : null }))).rejects.toThrow("read failed");
});

it("starts independent counts while membership loading is still pending", async () => {
  let release!: (value: { data: unknown[]; error: null }) => void;
  const membership = new Promise<{ data: unknown[]; error: null }>(resolve => { release = resolve; });
  const query = (range: () => Promise<{ data: unknown[]; error: null }>) => {
    const chain = { select: () => chain, eq: () => chain, order: () => chain, range };
    return chain;
  };
  const rpc = vi.fn(() => query(async () => ({ data: [], error: null })));
  const db = { from: () => query(() => membership), rpc } as unknown as SupabaseClient;
  const pending = loadDashboardSnapshot(db, "user");
  expect(rpc).toHaveBeenCalledWith("dashboard_group_counts");
  release({ data: [], error: null });
  expect((await pending).groups).toEqual([]);
});

function photoSnapshot(count: number) {
  const row: VisitRow = {
    id: "visit", group_id: "group", visited_on: "2026-10-28", is_planned: false,
    title: "사진 기록", note: "", rating: 5, tags: [], marker_style: null, version: 1,
    places: { id: "place", provider: "manual", provider_place_id: null, name: "장소", address: "", category: "", latitude: 37, longitude: 127 },
    visit_participants: [],
    visit_photos: Array.from({ length: count }, (_, i) => ({ id: String(i), storage_path: `photo/${i}`, sort_order: i })),
  };
  return { groups: [], members: [], rows: [row], activeGroupId: "group", etag: '"photos"' };
}

it("bounds concurrent photo batches and preserves photo order when signing finishes out of order", async () => {
  const releases: Array<() => void> = [];
  const sign = vi.fn((paths: string[]) => new Promise(resolve => {
    releases.push(() => resolve({ data: paths.map(path => ({ signedUrl: `signed:${path}` })), error: null }));
  }));
  const db = { storage: { from: () => ({ createSignedUrls: sign }) } } as unknown as SupabaseClient;
  const pending = materializeDashboard(db, photoSnapshot(1001));
  expect(sign).toHaveBeenCalledTimes(4);
  expect(sign.mock.calls.map(([paths]) => paths.length)).toEqual([250, 250, 250, 250]);
  for (const release of [...releases].reverse()) release();
  // Let the bounded first wave finish before its final one-photo batch starts.
  await vi.waitFor(() => expect(sign).toHaveBeenCalledTimes(5));
  releases[4]();
  const result = await pending;
  expect(result.visits[0].photoIds).toEqual(Array.from({ length: 1001 }, (_, i) => String(i)));
  expect(result.visits[0].photoUrls[1000]).toBe("signed:photo/1000");
  expect(result.photoWarning).toBeUndefined();
});

it("preserves successful photo batches and warns when another batch fails", async () => {
  const sign = vi.fn(async (paths: string[]) => {
    if (paths[0] === "photo/0") throw new Error("storage unavailable");
    return { data: paths.map(path => ({ signedUrl: `signed:${path}` })), error: null };
  });
  const db = { storage: { from: () => ({ createSignedUrls: sign }) } } as unknown as SupabaseClient;
  const result = await materializeDashboard(db, photoSnapshot(251));
  expect(result.visits[0].photoIds).toEqual(["250"]);
  expect(result.visits[0].photoOrder).toHaveLength(251);
  expect(result.photoWarning).toBeTruthy();
});
