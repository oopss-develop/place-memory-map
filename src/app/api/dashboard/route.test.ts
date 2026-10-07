import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), snapshot: vi.fn(), materialize: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
vi.mock("@/lib/data", () => ({ loadDashboardSnapshot: mocks.snapshot, materializeDashboard: mocks.materialize }));
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "user", supabase: {} }); mocks.snapshot.mockResolvedValue({ etag: '"revision"' }); mocks.materialize.mockResolvedValue({ visits: [] }); });
it("returns 304 without issuing new photo links, but renews expiring links", async () => {
  const headers = { "If-None-Match": '"revision"' };
  expect((await GET(new Request("http://localhost/api/dashboard", { headers }))).status).toBe(304);
  expect(mocks.materialize).not.toHaveBeenCalled();
  expect((await GET(new Request("http://localhost/api/dashboard?renewPhotos=true", { headers }))).status).toBe(200);
  expect(mocks.materialize).toHaveBeenCalledTimes(1);
});
it("requires authentication before querying records", async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await GET(new Request("http://localhost/api/dashboard"))).status).toBe(401);
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
