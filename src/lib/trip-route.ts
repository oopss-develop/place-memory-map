import { createHash } from "node:crypto";

import type { RouteStop } from "./trip-route-segments";
export type { RouteStop } from "./trip-route-segments";

export function routeSignature(tripId: string, date: string, provider: "kakao" | "osm", stops: RouteStop[]) {
  return createHash("sha256").update(JSON.stringify({
    version: 2,
    tripId,
    date,
    provider,
    stops: stops.map(({ id, itemIds, latitude, longitude }) => [itemIds ?? [id], latitude, longitude]),
  })).digest("hex");
}

export function sampleRoutePoints(points: Array<{ latitude: number; longitude: number }>, maximum = 4000) {
  if (points.length <= maximum) return points;
  const stride = Math.ceil((points.length - 1) / (maximum - 1));
  const sampled = points.filter((_, index) => index % stride === 0);
  if (sampled.at(-1) !== points.at(-1)) sampled.push(points.at(-1)!);
  return sampled;
}
