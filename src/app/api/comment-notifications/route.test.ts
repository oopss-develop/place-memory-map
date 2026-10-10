// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
vi.mock("@/lib/stickers", () => ({ resolveSticker: () => null }));
import { GET, POST } from "./route";
const id = "10000000-0000-4000-8000-000000000001";
const request = (data: unknown) => new Request("http://localhost/api/comment-notifications", { method: "POST", body: JSON.stringify(data) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: id, supabase: { rpc: mocks.rpc, from: mocks.from } });
  mocks.is.mockResolvedValue({ error: null, count: 1 }); mocks.eq.mockReturnValue({ eq: mocks.eq, is: mocks.is });
  mocks.update.mockReturnValue({ eq: mocks.eq }); mocks.from.mockReturnValue({ update: mocks.update, select: () => ({ eq: mocks.eq }) });
  mocks.rpc.mockResolvedValue({ data: [{ comment_id: id, visit_id: id, group_id: id, body: "", sticker_id: "gone/hi.gif", author_name: "뚜냥", place_name: "숲", created_at: "2026-10-10", read_at: null, own: false }], error: null });
});
it("requires authentication and rejects invalid read requests", async () => {
  mocks.auth.mockResolvedValueOnce(null); expect((await GET()).status).toBe(401);
  mocks.auth.mockResolvedValueOnce(null); expect((await POST(request({ commentId: id }))).status).toBe(401);
  expect((await POST(request({ commentId: "bad" }))).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("returns private notification metadata and handles missing sticker assets", async () => {
  const result = await GET(); expect(result.status).toBe(200);
  expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await result.json()).toMatchObject({ unreadCount: 1, notifications: [{ commentId: id, stickerName: "이모티콘" }] });
});
it("scopes reads to the logged-in user and keeps marking idempotent", async () => {
  for (let i = 0; i < 2; i++) expect((await POST(request({ commentId: id, userId: "other" }))).status).toBe(200);
  expect(mocks.eq).toHaveBeenCalledWith("user_id", id);
  expect(mocks.eq).toHaveBeenCalledWith("comment_id", id);
  expect(mocks.is).toHaveBeenCalledWith("read_at", null);
});
it("reports database failures without pretending the alert was read", async () => {
  mocks.is.mockResolvedValue({ error: { message: "DB failure" } });
  expect((await POST(request({ commentId: id }))).status).toBe(503);
});
