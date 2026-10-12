import type { TripRouteLeg } from "@/types/domain";

export interface RouteStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  itemIds?: string[];
}
export function sameRouteLocation(a: Pick<RouteStop, "latitude" | "longitude">, b: Pick<RouteStop, "latitude" | "longitude">) {
  return a.latitude.toFixed(6) === b.latitude.toFixed(6) && a.longitude.toFixed(6) === b.longitude.toFixed(6);
}
// Merge only adjacent visits. A return visit must remain a separate route stop.
export function orderedRouteStops(items: RouteStop[]): RouteStop[] {
  const stops: RouteStop[] = [];
  for (const item of items) {
    const previous = stops.at(-1);
    if (previous && sameRouteLocation(previous, item)) previous.itemIds!.push(item.id);
    else stops.push({ ...item, itemIds: [item.id] });
  }
  return stops;
}
export function routeLegs(stops: RouteStop[], sections: Array<{ distance?: number; duration?: number }> = []): TripRouteLeg[] {
  // An incomplete response must not shift a later section onto the wrong pair.
  if (sections.length !== stops.length - 1) return [];
  return sections.flatMap((section, index) => {
    if (!Number.isInteger(section.distance) || !Number.isInteger(section.duration) || section.distance! < 0 || section.duration! < 0) return [];
    return [{ fromItemId: stops[index].itemIds?.at(-1) ?? stops[index].id, toItemId: stops[index + 1].itemIds?.[0] ?? stops[index + 1].id, distanceMeters: section.distance!, durationSeconds: section.duration! }];
  });
}
export function formatRouteDuration(seconds: number) {
  if (seconds < 60) return "1분 미만";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}` : `${minutes}분`;
}
export function formatRouteDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}
