import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), admin: vi.fn(), memberIds: vi.fn(), share: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
vi.mock("@/lib/shared-maps", () => ({ createSharingAdmin: mocks.admin, getSharingMemberIds: mocks.memberIds, shareMapWithMembers: mocks.share }));
import { POST } from "@/app/api/groups/route";
const request = () => new Request("http://localhost/api/groups", { method: "POST", body: JSON.stringify({ name: "함께 보는 지도" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user0", supabase: { rpc: mocks.rpc, from: mocks.from } });
  mocks.admin.mockReturnValue("server-admin");
  mocks.memberIds.mockResolvedValue(["user0", "user1", "user2", "user3"]);
  mocks.share.mockResolvedValue(undefined);
  mocks.rpc.mockResolvedValue({ data: "map1", error: null });
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { id: "map1", name: "함께 보는 지도", created_by: "user0" }, error: null }) }) }) });
});

describe("shared map creation", () => {
  it("shares a new map with the registered members before reporting success", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect((await response.json()).group.memberCount).toBe(4);
    expect(mocks.share).toHaveBeenCalledWith("server-admin", "map1", "user0", ["user0", "user1", "user2", "user3"]);
  });

  it("does not call the admin client for an unauthenticated request", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("does not create a map if sharing accounts cannot be resolved", async () => {
    mocks.memberIds.mockRejectedValue(new Error("사용자 확인 실패"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns an existing map with a recovery notice when sharing fails, avoiding duplicate creation", async () => {
    mocks.share.mockRejectedValue(new Error("temporary failure"));
    const response = await POST(request());
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.group.id).toBe("map1");
    expect(result.notice).toContain("새로고침");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});
