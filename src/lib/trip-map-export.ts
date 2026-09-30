import type { MapPoint, TripRoute } from "@/types/domain";
import type { ExportMapImage } from "@/lib/trip-export";

// Coordinates provide an honest, offline fallback without implying road routing.
export function drawPlaceOverview(pins: MapPoint[], date: string, route?: TripRoute | null): ExportMapImage {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("지도 이미지를 만들지 못했어요.");
  ctx.fillStyle = "#f4efdf";
  ctx.fillRect(0, 0, 960, 600);
  ctx.fillStyle = "#162d38";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText(`${date} · 장소 위치도`, 32, 44);
  ctx.font = "16px sans-serif";
  ctx.fillText("지도 배경 없이 좌표로 표시한 위치도입니다. 실제 길은 장소 링크에서 확인하세요.", 32, 76);
  if (!pins.length) {
    ctx.fillText("선택한 날짜에 예정된 장소가 없어요.", 32, 140);
  } else {
    const origin = pins[0].place.longitude;
    const project = (latitude: number, longitude: number) => ({
      x: origin + ((longitude - origin + 540) % 360) - 180,
      y: Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, latitude)) * Math.PI / 360)) * 180 / Math.PI,
    });
    const points = pins.map((pin) => project(pin.place.latitude, pin.place.longitude));
    const routePoints = route?.points.map((point) => project(point.latitude, point.longitude)) ?? [];
    const all = [...points, ...routePoints];
    const minX = Math.min(...all.map((p) => p.x)), maxX = Math.max(...all.map((p) => p.x));
    const minY = Math.min(...all.map((p) => p.y)), maxY = Math.max(...all.map((p) => p.y));
    const scale = Math.min(800 / Math.max(.002, maxX - minX), 350 / Math.max(.002, maxY - minY));
    const position = (p: { x: number; y: number }) => ({ x: 480 + (p.x - (minX + maxX) / 2) * scale, y: 325 - (p.y - (minY + maxY) / 2) * scale });
    if (routePoints.length > 1) {
      ctx.strokeStyle = "#d84c32";
      ctx.lineWidth = 3;
      ctx.setLineDash(route?.kind === "straight" ? [8, 6] : []);
      ctx.beginPath();
      routePoints.forEach((p, index) => { const pos = position(p); if (index) ctx.lineTo(pos.x, pos.y); else ctx.moveTo(pos.x, pos.y); });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    points.forEach((p, index) => {
      const pos = position(p);
      const number = pins[index].pinNumber ?? String(index + 1);
      const radius = Math.max(20, Math.min(50, number.length * 7));
      ctx.fillStyle = "#d84c32";
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fffdf6";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#fffdf6";
      ctx.font = "bold 17px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(number, pos.x, pos.y + 6, radius * 1.8);
    });
    ctx.textAlign = "left";
    ctx.fillStyle = "#162d38";
    ctx.font = "16px sans-serif";
    ctx.fillText("북쪽 ↑ · 핀 번호는 아래 장소 목록과 일치합니다.", 32, 552);
  }
  return { dataUrl: canvas.toDataURL("image/png"), width: 960, height: 600, description: "장소 위치도 · 지도 배경 없음 · 아래 장소 이름을 누르면 실제 지도를 열 수 있어요." };
}

export async function captureTripMap(element: HTMLElement | null, pins: MapPoint[], date: string, route?: TripRoute | null): Promise<{ image: ExportMapImage; fallback: boolean }> {
  try {
    if (!element || element.clientWidth < 1 || element.clientHeight < 1 || element.querySelector(".map-fallback, .map-offline-fallback")) throw new Error("Map unavailable");
    const images = [...element.querySelectorAll<HTMLImageElement>("img")];
    // Check tiles first: the image library otherwise silently omits blocked images.
    if (!images.length || images.some((image) => !image.complete || !image.naturalWidth)) throw new Error("Map is loading");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const urls = [...new Set(images.map((image) => image.currentSrc || image.src).filter((url) => !url.startsWith("data:")))];
      await Promise.all(urls.map(async (url) => {
        const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
        if (!response.ok) throw new Error("Map image unavailable");
        await response.blob();
      }));
      const { toCanvas } = await import("html-to-image");
      const canvas = await toCanvas(element, {
        pixelRatio: 1.5, skipFonts: true, includeQueryParams: true,
        fetchRequestInit: { signal: controller.signal, credentials: "omit" },
        filter: (node) => !(node instanceof HTMLElement && node.classList.contains("planner-map-controls")),
      });
      return { image: { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height, description: `${date} · 현재 지도 화면 · 지도 이미지와 핀 위치는 다운로드 시점 기준입니다.` }, fallback: false };
    } finally { window.clearTimeout(timeout); }
  } catch {
    return { image: drawPlaceOverview(pins, date, route), fallback: true };
  }
}
