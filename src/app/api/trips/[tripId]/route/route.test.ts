import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), rpc: vi.fn(), fetch: vi.fn(), cache: null as unknown }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
import { GET, POST } from "@/app/api/trips/[tripId]/route/route";

const tripId = "40000000-0000-4000-8000-000000000001";
const date = "2026-10-03";
const context = { params: Promise.resolve({ tripId }) };
const stops = [
  { id: "item-1", starts_at: `${date}T09:00:00`, ends_at: `${date}T10:00:00`, place: { name: "출발", latitude: 37.5, longitude: 127 } },
  { id: "item-2", starts_at: `${date}T10:00:00`, ends_at: `${date}T11:00:00`, place: { name: "도착", latitude: 37.6, longitude: 127.1 } },
];
const cached = { route_kind: "road", route_points: [{ latitude: 37.5, longitude: 127 }, { latitude: 37.6, longitude: 127.1 }], distance_meters: 12000, duration_seconds: 900 };
const request = (method: "GET" | "POST") => new Request(`http://localhost/api/trips/${tripId}/route?date=${date}&provider=kakao`, {
  method,
  ...(method === "POST" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, provider: "kakao" }) } : {}),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
  mocks.cache = null;
  mocks.auth.mockResolvedValue({ supabase: { from: mocks.from, rpc: mocks.rpc } });
  mocks.from.mockImplementation((table: string) => {
    if (table === "trips") {
      const builder = { select: () => builder, eq: () => builder, is: () => builder, maybeSingle: async () => ({ data: { id: tripId, start_date: date, end_date: date }, error: null }) };
      return builder;
    }
    if (table === "schedule_items") {
      const builder = { select: () => builder, eq: () => builder, is: () => builder, lt: () => builder, gt: () => builder, order: () => builder, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: stops, error: null }).then(resolve) };
      return builder;
    }
    const builder = { select: () => builder, eq: () => builder, maybeSingle: async () => ({ data: mocks.cache, error: null }) };
    return builder;
  });
  mocks.rpc.mockResolvedValue({ data: { ...cached }, error: null });
  vi.stubGlobal("fetch", mocks.fetch);
});

describe("trip route cache API", () => {
  it("only reads the cache on GET and never calls Kakao Directions", async () => {
    const response = await GET(request("GET"), context) as Response;
    expect(response.status).toBe(200);
    expect((await response.json()).route).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("uses a shared cached road route without another Directions request", async () => {
    mocks.cache = cached;
    const response = await POST(request("POST"), context) as Response;
    expect(response.status).toBe(200);
    expect((await response.json()).cached).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls Kakao once on an explicit cache miss and saves its road geometry", async () => {
    mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ routes: [{ result_code: 0, summary: { distance: 12000, duration: 900 }, sections: [{ roads: [{ vertexes: [127, 37.5, 127.05, 37.55, 127.1, 37.6] }] }] }] }), { status: 200 }));
    const response = await POST(request("POST"), context) as Response;
    expect(response.status).toBe(200);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0][0]).toContain("apis-navi.kakaomobility.com/v1/waypoints/directions");
    expect(mocks.rpc).toHaveBeenCalledWith("save_trip_route", expect.objectContaining({ p_route_date: "2026-10-03", route_kind: "road", distance_meters: 12000, duration_seconds: 900 }));
  });

  it("requires authentication before any database or route service access", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await POST(request("POST"), context) as Response;
    expect(response.status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
