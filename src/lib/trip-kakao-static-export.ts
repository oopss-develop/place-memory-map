import type { ExportMapImage } from "@/lib/trip-export";
import type { TripRoute } from "@/types/domain";
import { tripMarkerDataUrl } from "@/lib/marker-styles";

export interface KakaoExportView {
  latitude: number;
  longitude: number;
  level: number;
  pins: Array<{ x: number; y: number; number: string }>;
  routePoints: Array<{ x: number; y: number }>;
}
export interface KakaoExportViewRef { current: (() => KakaoExportView) | null }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("지도 이미지를 읽지 못했습니다."));
    image.src = src;
  });
}

export async function captureKakaoStaticMap(view: KakaoExportView, date: string, route?: TripRoute | null): Promise<ExportMapImage> {
  const query = new URLSearchParams({ latitude: String(view.latitude), longitude: String(view.longitude), level: String(view.level) });
  const response = await fetch(`/api/maps/export-image?${query}`, { credentials: "same-origin", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("카카오 이미지 지도 요청에 실패했습니다.");
  const blob = await response.blob();
  if (blob.type !== "image/png") throw new Error("지도 이미지 형식이 올바르지 않습니다.");
  const objectUrl = URL.createObjectURL(blob);
  try {
    const background = await loadImage(objectUrl);
    if (background.naturalWidth !== 960 || background.naturalHeight !== 600) throw new Error("지도 이미지 크기가 올바르지 않습니다.");
    const canvas = document.createElement("canvas");
    canvas.width = 960; canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("지도 이미지를 만들지 못했습니다.");
    ctx.drawImage(background, 0, 0);
    if (view.routePoints.length > 1) {
      ctx.beginPath();
      view.routePoints.forEach((point, index) => { if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y); });
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 9; ctx.lineJoin = "round"; ctx.stroke();
      ctx.strokeStyle = "#0369a1"; ctx.lineWidth = 5;
      ctx.setLineDash(route?.kind === "straight" ? [8, 6] : []); ctx.stroke(); ctx.setLineDash([]);
    }
    const markers = await Promise.all(view.pins.map((pin) => loadImage(tripMarkerDataUrl(pin.number))));
    view.pins.forEach((pin, index) => ctx.drawImage(markers[index], pin.x - 22, pin.y - 48, 44, 48));
    // Keep the official Kakao logo unobscured by route/pin overlays.
    ctx.drawImage(background, 0, 570, 960, 30, 0, 570, 960, 30);
    return { dataUrl: canvas.toDataURL("image/png"), width: 960, height: 600, description: `${date} · 카카오 이미지 지도 · 번호 핀은 아래 방문 순서와 일치합니다.` };
  } finally { URL.revokeObjectURL(objectUrl); }
}
