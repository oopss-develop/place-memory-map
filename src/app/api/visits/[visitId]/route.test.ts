import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), snapshot: vi.fn(), materialize: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
vi.mock("@/lib/data", () => ({ loadVisitSnapshot: mocks.snapshot, materializeDashboard: mocks.materialize }));
import { GET } from "./route";
const visitId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const context = { params: Promise.resolve({ visitId }) };
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "user", supabase: {} }); mocks.snapshot.mockResolvedValue({ etag: '"one"' }); mocks.materialize.mockResolvedValue({ visits: [{ id: visitId, note: "첫 줄\n둘째 줄", rating: 4.5 }], groups: [{ name: "지도" }] }); });
it("requires authentication and hides removed or inaccessible visits", async () => {
  mocks.auth.mockResolvedValueOnce(null);
  expect((await GET(new Request("http://localhost/api/visits/" + visitId), context)).status).toBe(401);
  expect(mocks.snapshot).not.toHaveBeenCalled();
  mocks.snapshot.mockResolvedValueOnce(null);
  expect((await GET(new Request("http://localhost/api/visits/" + visitId), context)).status).toBe(404);
  expect(mocks.materialize).not.toHaveBeenCalled();
});
it("returns rating and multiline content and reuses photo URLs via ETag", async () => {
  const response = await GET(new Request("http://localhost/api/visits/" + visitId), context);
  expect((await response.json()).visit).toMatchObject({ rating: 4.5, note: "첫 줄\n둘째 줄" });
  mocks.materialize.mockClear();
  expect((await GET(new Request("http://localhost/api/visits/" + visitId, { headers: { "If-None-Match": '"one"' } }), context)).status).toBe(304);
  expect(mocks.snapshot).toHaveBeenCalledWith({}, "user", visitId);
  expect(mocks.materialize).not.toHaveBeenCalled();
});
