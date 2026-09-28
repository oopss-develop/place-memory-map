import { describe, expect, it } from "vitest";
import { routeSignature, sampleRoutePoints, type RouteStop } from "@/lib/trip-route";

const stops: RouteStop[] = [
  { id: "start", name: "출발", latitude: 37.5, longitude: 127 },
  { id: "end", name: "도착", latitude: 37.6, longitude: 127.1 },
];

describe("trip route cache keys and geometry", () => {
  it("changes the cache key when ordered stops, date, or map provider changes", () => {
    const key = routeSignature("trip", "2026-10-01", "kakao", stops);
    expect(routeSignature("trip", "2026-10-01", "kakao", stops)).toBe(key);
    expect(routeSignature("trip", "2026-10-01", "kakao", [...stops].reverse())).not.toBe(key);
    expect(routeSignature("trip", "2026-10-02", "kakao", stops)).not.toBe(key);
    expect(routeSignature("trip", "2026-10-01", "osm", stops)).not.toBe(key);
  });

  it("caps long road geometry while keeping its first and last points", () => {
    const points = Array.from({ length: 8001 }, (_, index) => ({ latitude: 35 + index / 100_000, longitude: 127 + index / 100_000 }));
    const sampled = sampleRoutePoints(points);
    expect(sampled.length).toBeLessThanOrEqual(4000);
    expect(sampled[0]).toBe(points[0]);
    expect(sampled.at(-1)).toBe(points.at(-1));
  });
});
