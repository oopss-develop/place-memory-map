import { resolveExportRoute, exportRouteDescription } from "@/lib/trip-export-route";
import { captureKakaoStaticMap, type KakaoExportViewRef } from "@/lib/trip-kakao-static-export";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { KakaoMap } from "@/components/kakao-map";
import { daySegments, tripDates } from "@/lib/timetable";
import { captureTripMap, drawPlaceOverview } from "@/lib/trip-map-export";
import type { DayMapImage } from "@/lib/trip-export";
import type { MapPoint, ScheduleItem, Trip, TripRoute } from "@/types/domain";

export function exportDayPins(items: ScheduleItem[], date: string): MapPoint[] {
  const grouped = new Map<string, MapPoint>();
  for (const { item, order } of daySegments(items, date)) {
    const key = `${item.place.latitude.toFixed(6)},${item.place.longitude.toFixed(6)}`;
    const existing = grouped.get(key);
    if (existing) existing.pinNumber += `,${order}`;
    else grouped.set(key, { id: item.id, place: item.place, markerStyle: item.markerStyle, pinNumber: String(order) });
  }
  return [...grouped.values()];
}

// A separate, full-sized map fits every pin without changing the user's viewport/date.
export async function captureTripDays(trip: Trip, input: ScheduleItem[], provider: "kakao" | "osm", current: { date: string; route: TripRoute | null; demo?: boolean }, progress: (text: string) => void): Promise<DayMapImage[]> {
  const items = input.filter((item) => item.tripId === trip.id);
  const dates = tripDates(trip);
  const output: DayMapImage[] = [];
  for (const [index, date] of dates.entries()) {
    progress(`지도 ${index + 1}/${dates.length} 준비 중…`);
    const pins = exportDayPins(items, date);
    progress(`동선 ${index + 1}/${dates.length} 준비 중…`);
    const route = await resolveExportRoute(trip.id, items, date, provider, date === current.date ? current.route : null, current.demo);
    const description = exportRouteDescription(route);
    progress(`지도 ${index + 1}/${dates.length} 준비 중…`);
    if (!pins.length) {
      output.push({ date, image: drawPlaceOverview([], date), fallback: false });
      continue;
    }
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;left:-12000px;top:0;width:960px;height:600px;pointer-events:none;background:white";
    document.body.append(host);
    const root = createRoot(host);
    const exportViewRef: KakaoExportViewRef = { current: null };
    try {
      root.render(createElement(KakaoMap, { visits: pins, mapProvider: provider, selectionRequest: 0, manualMode: false, onSelect: () => {}, onManualPoint: () => {}, route, exportViewRef }));
      const deadline = Date.now() + 12000;
      let signature = "", stable = 0;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
        if (host.querySelector(".map-fallback, .map-offline-fallback")) break;
        const images = [...host.querySelectorAll("img")];
        const next = images.map((img) => img.currentSrc || img.src).join("|");
        if (images.length && images.every((img) => img.complete && img.naturalWidth) && next === signature) stable++;
        else stable = 0;
        signature = next;
        if (stable >= 3 || (provider === "kakao" && exportViewRef.current && Date.now() > deadline - 11000)) break;
      }
      if (provider === "kakao" && exportViewRef.current) {
        try {
          const image = await captureKakaoStaticMap(exportViewRef.current(), date, route);
          output.push({ date, image: { ...image, description: `${image.description} · ${description}` }, fallback: false });
          continue;
        } catch { /* Preserve the existing capture/overview fallback if the API is unavailable. */ }
      }
      const result = await captureTripMap(host, pins, date, route);
      output.push({ date, ...result, image: { ...result.image, description: `${result.image.description}${description ? ` · ${description}` : ""}` } });
    } finally {
      root.unmount();
      host.remove();
    }
  }
  return output;
}
