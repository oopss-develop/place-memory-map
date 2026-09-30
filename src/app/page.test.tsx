import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), sync: vi.fn(), dashboard: vi.fn(), redirect: vi.fn(), journal: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
vi.mock("@/lib/shared-maps", () => ({ synchronizeSharedMaps: mocks.sync }));
vi.mock("@/lib/data", () => ({ getDashboardData: mocks.dashboard }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/components/map-journal", () => ({ MapJournal: mocks.journal }));
import Home from "@/app/page";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
  mocks.auth.mockResolvedValue({ userId: "user1", supabase: "user-session", member: { displayName: "사용자" } });
  mocks.sync.mockResolvedValue(undefined);
  mocks.dashboard.mockResolvedValue({ groups: [], members: [], visits: [], demoMode: false });
  mocks.redirect.mockImplementation(() => { throw new Error("login redirect"); });
});

afterEach(() => vi.unstubAllEnvs());

describe("shared dashboard", () => {
  it("connects existing maps before loading records through the user's RLS session", async () => {
    await Home();
    expect(mocks.sync.mock.invocationCallOrder[0]).toBeLessThan(mocks.dashboard.mock.invocationCallOrder[0]);
    expect(mocks.dashboard).toHaveBeenCalledWith("user-session", "user1");
  });

  it("does not grant memberships before authentication", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(Home()).rejects.toThrow("login redirect");
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
