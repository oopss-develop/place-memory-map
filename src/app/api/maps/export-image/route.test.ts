import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ auth: vi.fn(), configured: vi.fn() }));
vi.mock("@/lib/access-workspace", () => ({ getAccessWorkspaceUser: mocks.auth }));
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: mocks.configured }));
import { GET } from "./route";
const request = (query = "latitude=33.4&longitude=126.5&level=9") => new Request(`http://localhost/api/maps/export-image?${query}`);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
beforeEach(() => { mocks.configured.mockReturnValue(true); mocks.auth.mockResolvedValue({ userId: "user" }); vi.stubEnv("KAKAO_REST_API_KEY", "test-key"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Kakao static map export", () => {
  it("requires authentication and validates coordinates before contacting Kakao", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    mocks.auth.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    mocks.auth.mockResolvedValue({ userId: "user" });
    expect((await GET(request("latitude=999&longitude=126&level=9"))).status).toBe(400);
    expect((await GET(request("latitude=33&longitude=126&level=0"))).status).toBe(400);
    expect((await GET(request("longitude=126&level=9"))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the documented API with a private key and serves the actual PNG", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(png, { headers: { "Content-Type": "image/png" } })); vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.origin).toBe("https://dapi.kakao.com");
    expect(url.pathname).toBe("/v2/maps/staticmap");
    expect(url.searchParams.get("center")).toBe("126.5,33.4");
    expect(url.searchParams.get("lv")).toBe("9");
    expect(url.searchParams.get("scale")).toBe("1");
    expect(options.headers.Authorization).toBe("KakaoAK test-key");
  });

  it("handles absent keys, limits, invalid image responses and network errors", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    expect((await GET(request())).status).toBe(503);
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response("limit", { status: 429 })); vi.stubGlobal("fetch", fetchMock);
    expect((await GET(request())).status).toBe(429);
    fetchMock.mockResolvedValue(new Response("html", { headers: { "Content-Type": "image/png" } }));
    expect((await GET(request())).status).toBe(502);
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await GET(request())).status).toBe(502);
  });
});
