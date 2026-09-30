import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), listUsers: vi.fn(), from: vi.fn(), upsert: vi.fn(), range: vi.fn(), in: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import { createSharingAdmin, getSharingMemberIds, shareMapWithMembers, synchronizeSharedMaps } from "@/lib/shared-maps";

const members = Array.from({ length: 4 }, (_, index) => ({ email: `person${index}@example.com`, displayName: `사용자 ${index}` }));
const users = members.map((member, index) => ({ email: member.email, id: `user${index}` }));
const admin = { auth: { admin: { listUsers: mocks.listUsers } }, from: mocks.from } as unknown as SupabaseClient;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ALLOWED_MEMBERS_JSON", JSON.stringify(members));
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-server-key");
  mocks.createClient.mockReturnValue(admin);
  mocks.listUsers.mockResolvedValue({ data: { users }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.range.mockResolvedValue({ data: [{ id: "map1", created_by: "user0" }, { id: "map2", created_by: "user2" }], error: null });
  mocks.in.mockReturnValue({ order: () => ({ range: mocks.range }) });
  mocks.from.mockReturnValue({ upsert: mocks.upsert, select: () => ({ in: mocks.in }) });
});
afterEach(() => vi.unstubAllEnvs());

describe("automatic map sharing", () => {
  it("connects all four members to existing maps using RLS memberships and preserves ownership", async () => {
    await synchronizeSharedMaps();
    expect(mocks.in).toHaveBeenCalledWith("created_by", ["user0", "user1", "user2", "user3"]);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.arrayContaining([
      { group_id: "map1", user_id: "user0", role: "owner" },
      { group_id: "map1", user_id: "user1", role: "member" },
      { group_id: "map1", user_id: "user2", role: "member" },
      { group_id: "map1", user_id: "user3", role: "member" },
    ]), { onConflict: "group_id,user_id", ignoreDuplicates: true });
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.arrayContaining([{ group_id: "map2", user_id: "user2", role: "owner" }]), expect.anything());
  });

  it("only adds registered accounts and can add a member after their first login", async () => {
    mocks.listUsers.mockResolvedValueOnce({ data: { users: [users[0], { id: "outsider", email: "other@example.com" }] }, error: null });
    expect(await getSharingMemberIds(admin)).toEqual(["user0"]);
    expect(await getSharingMemberIds(admin)).toEqual(["user0", "user1", "user2", "user3"]);
  });

  it("searches later account pages", async () => {
    mocks.listUsers.mockResolvedValueOnce({ data: { users: Array.from({ length: 1000 }, (_, index) => ({ id: String(index), email: `outside${index}@example.com` })) }, error: null });
    expect(await getSharingMemberIds(admin)).toHaveLength(4);
    expect(mocks.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 1000 });
  });

  it("fails closed when configuration or membership writes fail", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => createSharingAdmin()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
    await expect(shareMapWithMembers(admin, "map1", "outsider", ["user0"])).rejects.toThrow("등록된 사용자");
    expect(mocks.upsert).not.toHaveBeenCalled();
    mocks.upsert.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(shareMapWithMembers(admin, "map1", "user0", ["user0"])).rejects.toThrow("공유 권한");
  });
});
