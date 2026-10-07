import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), snapshot: vi.fn(), materialize: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
vi.mock("@/lib/overview-server", () => ({ loadOverviewSnapshot: mocks.snapshot, materializeOverview: mocks.materialize }));
import { GET } from "./route";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "user", supabase: {} }); mocks.snapshot.mockResolvedValue({ etag: '"revision"', data: {} }); mocks.materialize.mockResolvedValue({ totals: { visits: 2 } }); });
it("returns 304 without signing images and renews them only when requested", async () => {
  const headers = { "If-None-Match": '"revision"' };
  expect((await GET(new Request("http://localhost/api/overview", { headers }))).status).toBe(304);
  expect(mocks.materialize).not.toHaveBeenCalled();
  expect((await GET(new Request("http://localhost/api/overview?renewPhotos=true", { headers }))).status).toBe(200);
  expect(mocks.materialize).toHaveBeenCalledTimes(1);
});
it("checks authentication, validates selectors and denies inaccessible maps", async () => {
  mocks.auth.mockResolvedValueOnce(null);
  expect((await GET(new Request("http://localhost/api/overview"))).status).toBe(401);
  expect((await GET(new Request("http://localhost/api/overview?period=week"))).status).toBe(400);
  expect((await GET(new Request("http://localhost/api/overview?groupId=invalid"))).status).toBe(400);
  expect(mocks.snapshot).not.toHaveBeenCalled();
  mocks.snapshot.mockRejectedValueOnce(Object.assign(new Error("denied"), { status: 403 }));
  expect((await GET(new Request("http://localhost/api/overview"))).status).toBe(403);
});
