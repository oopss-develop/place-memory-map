// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), insert: vi.fn(), remove: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
vi.mock("@/lib/stickers", () => ({ resolveSticker: (id: string) => id === "a/hi.gif" ? { id } : null }));
import { POST } from "./route";
const request = (data: unknown) => new Request("http://localhost/api/stickers/favorites", { method: "POST", body: JSON.stringify(data) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner", supabase: { from: mocks.from } });
  mocks.from.mockReturnValue({ insert: mocks.insert, delete: mocks.remove });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.remove.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: async () => ({ error: null }) });
});
it("requires auth and rejects unknown paths", async () => {
  mocks.auth.mockResolvedValueOnce(null);
  expect((await POST(request({ stickerId: "a/hi.gif", favorite: true }))).status).toBe(401);
  expect((await POST(request({ stickerId: "../hi.gif", favorite: true }))).status).toBe(400);
  expect(mocks.from).not.toHaveBeenCalled();
});
it("uses the authenticated identity, supports idempotent adds and scopes removals", async () => {
  expect((await POST(request({ stickerId: "a/hi.gif", favorite: true, userId: "other" }))).status).toBe(200);
  expect(mocks.insert).toHaveBeenCalledWith({ user_id: "owner", sticker_id: "a/hi.gif" });
  mocks.insert.mockResolvedValueOnce({ error: { code: "23505" } });
  expect((await POST(request({ stickerId: "a/hi.gif", favorite: true }))).status).toBe(200);
  expect((await POST(request({ stickerId: "a/hi.gif", favorite: false }))).status).toBe(200);
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
});
