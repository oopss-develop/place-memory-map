import { daySegments } from "@/lib/timetable";
import { orderedRouteStops } from "@/lib/trip-route-segments";
import type { ScheduleItem, TripRoute } from "@/types/domain";

// Derive route stops from visits in time order, preserving return visits (A → B → A).
export async function resolveExportRoute(tripId: string, items: ScheduleItem[], date: string, provider: "kakao" | "osm", visibleRoute: TripRoute | null, demo = false): Promise<TripRoute | null> {
  const stops = orderedRouteStops(daySegments(items.filter((item) => item.tripId === tripId), date).map(({ item }) => ({ id: item.id, name: item.place.name, latitude: item.place.latitude, longitude: item.place.longitude })));
  if (stops.length < 2) return null;
  const valid = (route: TripRoute | null | undefined): route is TripRoute => Boolean(route && ["road", "straight"].includes(route.kind) && route.points?.length >= 2 && route.points.every((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)));
  if (valid(visibleRoute) && visibleRoute.kind === "road") return visibleRoute;
  if (!demo && provider === "kakao") {
    try {
      const response = await fetch(`/api/trips/${encodeURIComponent(tripId)}/route`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, provider }), signal: AbortSignal.timeout(20000),
      });
      if (response.ok) {
        const data = await response.json() as { route?: TripRoute };
        if (valid(data.route)) return data.route;
      }
    } catch { /* An unavailable road route is explicitly labelled as a straight connection. */ }
  }
  return { kind: "straight", points: stops.map(({ latitude, longitude }) => ({ latitude, longitude })) };
}

export function exportRouteDescription(route: TripRoute | null) {
  return route?.kind === "road" ? "자동차 경로 · 파란 굵은 실선" : route ? "방문 순서 연결 · 점선 (실제 도로 경로 아님)" : "";
}
