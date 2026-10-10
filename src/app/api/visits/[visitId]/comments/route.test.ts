// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
import { GET, POST, DELETE } from "./route";
const id = "10000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ visitId: id }) };
const request = (data: unknown) => new Request("http://localhost/api/comments", { method: "POST", body: JSON.stringify(data) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: id, supabase: { rpc: mocks.rpc, from: mocks.from } });
  mocks.rpc.mockResolvedValue({ error: null });
});
it("requires authentication for reading and writing", async () => {
  mocks.auth.mockResolvedValue(null);
  expect((await GET(request({}), context)).status).toBe(401);
  expect((await POST(request({ id, body: "hi" }), context)).status).toBe(401);
  expect((await DELETE(request({ id }), context)).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects empty, oversized and malformed comments before writing", async () => {
  for (const body of [" ", "x".repeat(1001)]) expect((await POST(request({ id, body }), context)).status).toBe(400);
  expect((await POST(request({ id: "bad", body: "hi" }), context)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("preserves a comment UUID across retries and trims its text", async () => {
  for (let i = 0; i < 2; i++) expect((await POST(request({ id, body: " hi " }), context)).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("add_visit_comment", { target_visit: id, comment_id: id, comment_body: "hi" });
});
it("surfaces membership, author and retry conflicts", async () => {
  mocks.rpc.mockResolvedValueOnce({ error: { code: "42501" } }).mockResolvedValueOnce({ error: { code: "40001" } });
  expect((await DELETE(request({ id }), context)).status).toBe(403);
  expect((await POST(request({ id, body: "changed" }), context)).status).toBe(409);
});
it("does not return comments for a deleted or inaccessible visit", async () => {
  const query = { select: () => query, eq: () => query, is: () => query, maybeSingle: async () => ({ data: null, error: null }) };
  mocks.from.mockReturnValue(query);
  expect((await GET(request({}), context)).status).toBe(404);
  expect(mocks.from).toHaveBeenCalledTimes(1);
});
