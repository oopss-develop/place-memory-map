import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
import { GET, POST, DELETE } from "@/app/api/trips/route";
import { POST as saveItem } from "@/app/api/trips/[tripId]/items/route";

const groupId = "20000000-0000-4000-8000-000000000001";
const tripId = "40000000-0000-4000-8000-000000000001";
const payload = { groupId, name: "주말", startDate: "2026-09-28", endDate: "2026-09-30", timeZone: "Asia/Seoul", version: 1 };
const request = (body: unknown) => new Request("http://localhost/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "user", supabase: { rpc: mocks.rpc, from: mocks.from } }); });
describe("trip routes", () => {
  it("requires authentication before accepting input", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request(payload))).status).toBe(401);
    expect((await GET(new Request(`http://localhost/api/trips?groupId=${groupId}`))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid ranges and malformed JSON before RPC", async () => {
    expect((await POST(request({ ...payload, endDate: "2026-09-01" }))).status).toBe(400);
    expect((await POST(new Request("http://localhost/api/trips", { method: "POST", body: "{" }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("returns a conflict instead of overwriting another member", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "40001", message: "다른 멤버가 먼저 수정했습니다." } });
    const response = await POST(request({ ...payload, id: tripId }));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("다른 멤버");
  });
  it("reports missing migration separately", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "PGRST202" } });
    const response = await POST(request(payload));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("202609280001");
  });
  it("passes expected version on deletion and translates forbidden access", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "42501", message: "권한 없음" } });
    expect((await DELETE(request({ id: tripId, version: 7 }))).status).toBe(403);
    expect(mocks.rpc).toHaveBeenCalledWith("delete_trip", { target_id: tripId, expected_version: 7 });
  });
  it("validates schedule duration and path ID without contacting RPC", async () => {
    const context = { params: Promise.resolve({ tripId }) };
    const item = { place: { name: "장소", provider: "manual", latitude: 37, longitude: 127 }, startsAt: "2026-09-28T09:00", endsAt: "2026-09-28T09:00", title: "방문" };
    expect((await saveItem(request(item), context)).status).toBe(400);
    expect((await saveItem(request(item), { params: Promise.resolve({ tripId: "wrong" }) })).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
