import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadVisitSnapshot } from "./data";
it("checks map membership with the authenticated user's session before returning a visit", async () => {
  const row = { id: "visit", group_id: "group" };
  const eq = vi.fn();
  const db = { from: (table: string) => {
    const query = { select: () => query, eq: (key: string, value: string) => { eq(table, key, value); return query; }, is: () => query, maybeSingle: async () => ({ data: table === "visits" ? row : null, error: null }) };
    return query;
  } } as unknown as SupabaseClient;
  expect(await loadVisitSnapshot(db, "user", "visit")).toBeNull();
  expect(eq).toHaveBeenCalledWith("visits", "id", "visit");
  expect(eq).toHaveBeenCalledWith("group_members", "user_id", "user");
  expect(eq).toHaveBeenCalledWith("group_members", "group_id", "group");
});
