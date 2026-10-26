// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
vi.mock("@/lib/data", () => ({ readPages: mocks.read }));
import { GET, POST, PUT, DELETE } from "./route";
const id = "10000000-0000-4000-8000-000000000001";
const input = { id, groupId: id, title: "서핑 배우기", kind: "activity", requestId: id };
const request = (value: unknown) => new Request("http://localhost/api/bucket-list", { method: "POST", body: JSON.stringify(value) });
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: id, supabase: { rpc: mocks.rpc } }); mocks.rpc.mockResolvedValue({ data: { id }, error: null }); mocks.read.mockResolvedValue([]); });
it("requires authentication for reads and mutations", async () => {
  mocks.auth.mockResolvedValue(null);
  for (const handler of [GET, POST, PUT, DELETE]) expect((await handler(request(input))).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("saves undated activities with an explicitly absent optional location", async () => {
  expect((await POST(request(input))).status).toBe(201);
  expect(mocks.rpc).toHaveBeenCalledWith("save_bucket_item", { input: expect.objectContaining({ place: null, reason: "", tags: [], requestId: id }), creating: true });
});
it("rejects incomplete titles and invalid coordinates before saving", async () => {
  expect((await POST(request({ ...input, title: " " }))).status).toBe(400);
  expect((await POST(request({ ...input, place: { provider: "manual", name: "해변", latitude: 200, longitude: 127 } }))).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("reports concurrent edits and permission failures instead of claiming success", async () => {
  mocks.rpc.mockResolvedValueOnce({ error: { code: "40001", message: "다른 멤버가 수정했습니다." } }).mockResolvedValueOnce({ error: { code: "42501", message: "접근할 수 없습니다." } });
  expect((await PUT(request(input))).status).toBe(409);
  expect((await DELETE(request({ id, version: 1 }))).status).toBe(403);
});
