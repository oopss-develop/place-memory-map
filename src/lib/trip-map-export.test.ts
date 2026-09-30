import { afterEach, describe, expect, it, vi } from "vitest";
import { captureTripMap, drawPlaceOverview } from "@/lib/trip-map-export";
import type { MapPoint } from "@/types/domain";

const { toCanvas } = vi.hoisted(() => ({ toCanvas: vi.fn() }));
vi.mock("html-to-image", () => ({ toCanvas }));
const pin = (latitude: number, longitude: number, number: string): MapPoint => ({ id: number, markerStyle: "black-9", pinNumber: number, place: { id: number, name: "장소", provider: "manual", address: "", category: "", latitude, longitude } });

function canvasMocks() {
  const ctx = { fillRect: vi.fn(), fillText: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(), setLineDash: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,test");
  return ctx;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); toCanvas.mockReset(); });

describe("map export", () => {
  it("shows north above south and keeps shared-place pin numbers in an explicitly labelled fallback", () => {
    const ctx = canvasMocks();
    const image = drawPlaceOverview([pin(37.6, 127, "1,3"), pin(37.5, 127, "2")], "2026-10-03");
    expect(ctx.arc.mock.calls[0][1]).toBeLessThan(ctx.arc.mock.calls[1][1]);
    expect(ctx.fillText).toHaveBeenCalledWith("1,3", expect.any(Number), expect.any(Number), expect.any(Number));
    expect(image.description).toContain("지도 배경 없음");
    expect(image).toMatchObject({ width: 960, height: 600 });
  });

  it("uses a position overview for hidden maps and blocked tiles", async () => {
    canvasMocks();
    expect((await captureTripMap(null, [], "2026-10-03")).fallback).toBe(true);
    const element = readyMap();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("CORS")));
    expect((await captureTripMap(element, [pin(37.5, 127, "1")], "2026-10-03")).fallback).toBe(true);
    expect(toCanvas).not.toHaveBeenCalled();
  });

  it("embeds the actual map when tiles are ready and readable", async () => {
    canvasMocks();
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 400;
    toCanvas.mockResolvedValue(canvas);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob() }));
    const result = await captureTripMap(readyMap(), [pin(37.5, 127, "1")], "2026-10-03");
    expect(result.fallback).toBe(false);
    expect(result.image.description).toContain("현재 지도 화면");
    expect(result.image).toMatchObject({ width: 600, height: 400 });
  });
});

function readyMap() {
  const element = document.createElement("div");
  Object.defineProperties(element, { clientWidth: { value: 400 }, clientHeight: { value: 300 } });
  const image = document.createElement("img");
  image.src = "https://example.com/tile.png";
  Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 256 } });
  element.append(image);
  return element;
}
