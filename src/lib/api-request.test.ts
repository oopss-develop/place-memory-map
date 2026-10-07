import { afterEach, expect, it, vi } from "vitest";
import { apiRequest } from "./api-request";
afterEach(() => vi.unstubAllGlobals());
it("distinguishes a non-JSON upstream failure from an expired login", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("upstream unavailable", { status: 502 })).mockResolvedValueOnce(Response.json({ error: "raw auth error" }, { status: 401 })));
  await expect(apiRequest("/api/test")).rejects.toMatchObject({ status: 502, message: expect.stringContaining("서버 응답") });
  await expect(apiRequest("/api/test")).rejects.toMatchObject({ status: 401, message: expect.stringContaining("로그인") });
});
