import { afterEach, describe, expect, it, vi } from "vitest";
import { captureKakaoStaticMap, type KakaoExportView } from "./trip-kakao-static-export";
const view: KakaoExportView = { latitude: 33.4, longitude: 126.5, level: 9, pins: [{ x: 120, y: 240, number: "1,3" }, { x: 400, y: 300, number: "2" }], routePoints: [{ x: 120, y: 240 }, { x: 400, y: 300 }] };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("composites a real same-origin PNG with projected route/pins and preserves the logo", async () => {
  const images: { src: string }[] = [];
  vi.stubGlobal("Image", class {
    naturalWidth = 960; naturalHeight = 600; onload?: () => void;
    set src(value: string) { images.push({ src: value }); queueMicrotask(() => this.onload?.()); }
  });
  const strokes: Array<{ width: number; color: string }> = [];
  const ctx = { lineWidth: 0, strokeStyle: "", drawImage: vi.fn(), beginPath: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), stroke: vi.fn(), setLineDash: vi.fn() };
  ctx.stroke.mockImplementation(() => strokes.push({ width: ctx.lineWidth, color: ctx.strokeStyle }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["png"], { type: "image/png" }) }));
  const revoke = vi.fn(); vi.stubGlobal("URL", class extends URL { static createObjectURL() { return "blob:map"; } static revokeObjectURL = revoke; });
  const result = await captureKakaoStaticMap(view, "2026-10-24", { kind: "road", points: [] });
  expect(result.description).toContain("카카오 이미지 지도");
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/maps/export-image?latitude=33.4"), expect.objectContaining({ credentials: "same-origin" }));
  expect(ctx.drawImage).toHaveBeenCalledWith(expect.anything(), 98, 192, 44, 48);
  expect(ctx.drawImage).toHaveBeenLastCalledWith(expect.anything(), 0, 570, 960, 30, 0, 570, 960, 30);
  expect(ctx.lineTo).toHaveBeenCalledWith(400, 300);
  expect(strokes).toEqual([{ width: 12, color: "#ffffff" }, { width: 7, color: "#0369a1" }]);
  expect(ctx.setLineDash).toHaveBeenCalledWith([]);
  expect(decodeURIComponent(images[1].src)).toContain("1,3");
  expect(revoke).toHaveBeenCalledWith("blob:map");
});

describe("static map failures", () => {
  it("rejects API failures and non-image responses so the caller can use the fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failure", { status: 502 })));
    await expect(captureKakaoStaticMap(view, "2026-10-24")).rejects.toThrow("요청에 실패");
    vi.mocked(fetch).mockResolvedValue(new Response("<html>error</html>"));
    await expect(captureKakaoStaticMap(view, "2026-10-24")).rejects.toThrow("형식");
  });
});
